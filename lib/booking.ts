import {
  DURACION_POR_DEFECTO,
  type EstilistaDelDia,
  fechaLocal,
  type HorarioLibre,
  horariosLibres,
  limitesDelDia,
  ZONA_HORARIA,
} from "@/lib/availability";

/** Función de consulta con plantillas (la del cliente postgres o la de una transacción). */
export type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;

export type ServicioReservable = { id: string; service_name: string; price: string; duration_minutes: number };

export class ReservaInvalida extends Error {
  constructor(
    message: string,
    public campo: string,
  ) {
    super(message);
  }
}

/** El servicio del negocio (y de la sucursal, si se eligió una aprobada), o ReservaInvalida. */
export async function servicioReservable(
  db: Sql,
  { businessUserId, branchId, serviceId }: { businessUserId: string; branchId: string | null; serviceId: string },
): Promise<ServicioReservable> {
  if (branchId) {
    const [sucursal] = await db`
      SELECT id FROM stylehub_business_branches
      WHERE id = ${branchId} AND business_user_id = ${businessUserId} AND validation_status = 'approved'
      LIMIT 1
    `;
    if (!sucursal) throw new ReservaInvalida("La sucursal seleccionada no es válida para este negocio.", "branchId");
  }
  const [servicio] = (branchId
    ? await db`
        SELECT id, service_name, price, duration_minutes FROM stylehub_business_services
        WHERE id = ${serviceId} AND business_user_id = ${businessUserId} AND branch_id = ${branchId}
        LIMIT 1
      `
    : await db`
        SELECT id, service_name, price, duration_minutes FROM stylehub_business_services
        WHERE id = ${serviceId} AND business_user_id = ${businessUserId}
        LIMIT 1
      `) as Array<{ id: string; service_name: string; price: string; duration_minutes: number | null }>;
  if (!servicio) throw new ReservaInvalida("El servicio seleccionado no pertenece a la sucursal elegida.", "serviceId");
  return { ...servicio, duration_minutes: servicio.duration_minutes || DURACION_POR_DEFECTO };
}

/** Estilistas disponibles del negocio que hacen el servicio (en la sucursal, si se eligió). */
export async function estilistasCandidatos(
  db: Sql,
  args: { businessUserId: string; branchId: string | null; serviceId: string; stylistId: string | null },
): Promise<string[]> {
  const filas = (await db`
    SELECT s.id
    FROM stylehub_business_stylists s
    JOIN stylehub_stylist_services ss ON ss.stylist_id = s.id AND ss.service_id = ${args.serviceId}
    WHERE s.business_user_id = ${args.businessUserId}
      AND s.available = TRUE
      AND (${args.branchId}::uuid IS NULL OR s.branch_id = ${args.branchId}::uuid)
      AND (${args.stylistId}::uuid IS NULL OR s.id = ${args.stylistId}::uuid)
    ORDER BY s.id
  `) as Array<{ id: string }>;
  return filas.map((f) => f.id);
}

/**
 * Bloques del día y tiempo ocupado (citas que no están canceladas y ausencias) de cada estilista.
 * excluirCita: al reagendar, la propia cita no cuenta como ocupada. carga = citas del día por estilista.
 */
export async function agendaDelDia(
  db: Sql,
  ids: string[],
  fecha: string,
  zona = ZONA_HORARIA,
  excluirCita: string | null = null,
): Promise<EstilistaDelDia[] & { carga?: Record<string, number> }> {
  if (ids.length === 0) return [];
  const { start, end } = limitesDelDia(fecha, zona);
  const [bloques, citas, ausencias] = (await Promise.all([
    db`
      SELECT stylist_id, day_of_week, start_time, end_time FROM stylehub_stylist_schedule_blocks
      WHERE stylist_id = ANY(${ids}::uuid[])
    `,
    db`
      SELECT stylist_id, scheduled_at, ends_at FROM stylehub_client_appointments
      WHERE stylist_id = ANY(${ids}::uuid[]) AND status <> 'cancelled'
        AND scheduled_at < ${end.toISOString()} AND ends_at > ${start.toISOString()}
        AND (${excluirCita}::uuid IS NULL OR id <> ${excluirCita}::uuid)
    `,
    db`
      SELECT stylist_id, starts_at, ends_at FROM stylehub_stylist_absences
      WHERE stylist_id = ANY(${ids}::uuid[])
        AND starts_at < ${end.toISOString()} AND ends_at > ${start.toISOString()}
    `,
  ])) as [
    Array<{ stylist_id: string; day_of_week: number; start_time: string; end_time: string }>,
    Array<{ stylist_id: string; scheduled_at: string | Date; ends_at: string | Date }>,
    Array<{ stylist_id: string; starts_at: string | Date; ends_at: string | Date }>,
  ];
  const resultado = ids.map((id) => ({
    id,
    bloques: bloques
      .filter((b) => b.stylist_id === id)
      .map((b) => ({ dayOfWeek: Number(b.day_of_week), start: b.start_time, end: b.end_time })),
    ocupado: [
      ...citas.filter((c) => c.stylist_id === id).map((c) => ({ start: new Date(c.scheduled_at), end: new Date(c.ends_at) })),
      ...ausencias.filter((a) => a.stylist_id === id).map((a) => ({ start: new Date(a.starts_at), end: new Date(a.ends_at) })),
    ],
  }));
  const carga = Object.fromEntries(ids.map((id) => [id, citas.filter((c) => c.stylist_id === id).length]));
  return Object.assign(resultado, { carga });
}

export async function disponibilidad(
  db: Sql,
  args: { businessUserId: string; branchId: string | null; serviceId: string; stylistId: string | null; fecha: string; ahora?: Date },
): Promise<{ servicio: ServicioReservable; horarios: HorarioLibre[] }> {
  const servicio = await servicioReservable(db, args);
  const ids = await estilistasCandidatos(db, args);
  const estilistas = await agendaDelDia(db, ids, args.fecha);
  const horarios = horariosLibres({ fecha: args.fecha, duracionMin: servicio.duration_minutes, estilistas, ahora: args.ahora ?? new Date() });
  return { servicio, horarios };
}


// --- Reservar, cancelar y reagendar -----------------------------------------------------------

/** Plazo del cliente para cancelar o reagendar (decisión de producto del 2026-11-12). */
export const PLAZO_CLIENTE_MIN = 120;

export class HorarioNoDisponible extends Error {
  constructor() {
    super("Este horario ya no está disponible. Por favor selecciona otro.");
  }
}
export class SaldoInsuficiente extends Error {
  constructor() {
    super("Saldo insuficiente para pagar esta cita.");
  }
}

/**
 * Cliente con transacciones (sql.begin del paquete postgres): el callback recibe la conexión de la
 * transacción y devuelve la lista de consultas, que se envían juntas entre BEGIN y COMMIT.
 */
export type SqlTx = Sql & { begin: (fn: (tx: Sql) => Promise<unknown[]>[]) => Promise<unknown[][]> };

const VIOLACION_DE_EXCLUSION = "23P01"; // la restricción stylehub_appointments_no_overlap

/** Candado por estilista hasta que termine la transacción: dos reservas del mismo estilista se forman. */
function candado(db: Sql, stylistId: string) {
  return db`SELECT pg_advisory_xact_lock(hashtextextended(${stylistId}::text, 0))`;
}

/** Ordena a los estilistas libres por menos citas ese día (y por id, para que sea estable). */
function porCarga(libres: string[], carga: Record<string, number> = {}) {
  return [...libres].sort((a, b) => (carga[a] ?? 0) - (carga[b] ?? 0) || a.localeCompare(b));
}

export type DatosReserva = {
  clienteId: string;
  businessUserId: string;
  branchId: string | null;
  serviceId: string;
  stylistId: string | null; // null = cualquiera
  inicio: Date;
  pago: "cash" | "wallet";
  notas: string | null;
  ahora?: Date;
};

/**
 * Crea la cita confirmada, o lanza HorarioNoDisponible / SaldoInsuficiente / ReservaInvalida.
 * El precio sale del servicio; un servicio de $0 se reserva sin cobro. Solo se aceptan horarios que
 * el propio motor ofrece. Para cada estilista libre (el elegido, o por menos carga si es "cualquiera"):
 * en una transacción, candado del estilista + una sola sentencia que vuelve a revisar traslapes y
 * ausencias, cobra el monedero y crea la cita; si algo no se cumple, no se cobra ni se crea nada.
 */
export async function reservar(db: SqlTx, d: DatosReserva) {
  const servicio = await servicioReservable(db, d);
  const monto = Number(servicio.price);
  if (!Number.isFinite(monto) || monto < 0) throw new ReservaInvalida("El servicio no tiene un precio válido.", "serviceId");
  const pago = monto === 0 ? "free" : d.pago;
  const fin = new Date(d.inicio.getTime() + servicio.duration_minutes * 60_000);

  const fecha = fechaLocal(d.inicio);
  const ids = await estilistasCandidatos(db, d);
  const agenda = await agendaDelDia(db, ids, fecha);
  const horario = horariosLibres({ fecha, duracionMin: servicio.duration_minutes, estilistas: agenda, ahora: d.ahora ?? new Date() })
    .find((h) => h.inicio.getTime() === d.inicio.getTime());
  if (!horario) throw new HorarioNoDisponible();

  for (const stylistId of porCarga(horario.estilistas, agenda.carga)) {
    const usaMonedero = pago === "wallet";
    let fila: { cita: Record<string, unknown> | null; ocupado: boolean } | undefined;
    try {
      const [, resultado] = await db.begin((tx) => [
        candado(tx, stylistId),
        tx`
          WITH conflicto AS (
            SELECT 1 FROM stylehub_client_appointments
            WHERE stylist_id = ${stylistId}::uuid AND status <> 'cancelled'
              AND scheduled_at < ${fin.toISOString()}::timestamptz AND ends_at > ${d.inicio.toISOString()}::timestamptz
            UNION ALL
            SELECT 1 FROM stylehub_stylist_absences
            WHERE stylist_id = ${stylistId}::uuid
              AND starts_at < ${fin.toISOString()}::timestamptz AND ends_at > ${d.inicio.toISOString()}::timestamptz
          ),
          debito AS (
            UPDATE stylehub_client_wallets
            SET balance = balance - ${monto}::numeric, updated_at = NOW()
            WHERE user_id = ${d.clienteId}::uuid AND ${usaMonedero}::boolean
              AND balance >= ${monto}::numeric AND NOT EXISTS (SELECT 1 FROM conflicto)
            RETURNING id
          ),
          cita AS (
            INSERT INTO stylehub_client_appointments (
              client_user_id, business_user_id, branch_id, service_id, service_name, stylist_id,
              scheduled_at, ends_at, time_zone, total_amount, payment_method_id, payment_provider, notes,
              status, updated_at
            )
            SELECT ${d.clienteId}::uuid, ${d.businessUserId}::uuid, ${d.branchId}::uuid, ${servicio.id}::uuid,
              ${servicio.service_name}, ${stylistId}::uuid, ${d.inicio.toISOString()}::timestamptz,
              ${fin.toISOString()}::timestamptz, ${ZONA_HORARIA}, ${monto}::numeric, NULL, ${pago}, ${d.notas},
              'confirmed', NOW()
            WHERE NOT EXISTS (SELECT 1 FROM conflicto)
              AND (NOT ${usaMonedero}::boolean OR EXISTS (SELECT 1 FROM debito))
            RETURNING id, service_name, scheduled_at, ends_at, stylist_id, status, total_amount, payment_provider, notes, created_at
          ),
          movimiento AS (
            INSERT INTO stylehub_client_wallet_transactions
              (wallet_id, user_id, transaction_type, amount, payment_provider, status, notes, appointment_id)
            SELECT debito.id, ${d.clienteId}::uuid, 'debit', ${monto}::numeric, 'wallet', 'completed',
              ${`Pago de cita: ${servicio.service_name}`}, cita.id
            FROM debito, cita
            RETURNING id
          )
          SELECT (SELECT row_to_json(cita) FROM cita) AS cita, EXISTS (SELECT 1 FROM conflicto) AS ocupado
        `,
      ]);
      fila = (resultado as Array<{ cita: Record<string, unknown> | null; ocupado: boolean }>)[0];
    } catch (error) {
      if ((error as { code?: string }).code === VIOLACION_DE_EXCLUSION) continue; // otro lo tomó: siguiente estilista
      throw error;
    }
    if (fila?.cita) return fila.cita;
    if (fila && !fila.ocupado) throw new SaldoInsuficiente();
  }
  throw new HorarioNoDisponible();
}

type CitaActual = {
  id: string;
  client_user_id: string;
  business_user_id: string;
  branch_id: string | null;
  service_id: string | null;
  stylist_id: string | null;
  status: string;
  scheduled_at: string | Date;
};

export class CitaNoModificable extends Error {}

/**
 * Cancela la cita y, si se pagó con el monedero, devuelve el 100 % en la misma sentencia.
 * por = "cliente": solo sus citas pendientes o confirmadas, hasta PLAZO_CLIENTE_MIN antes.
 * por = "negocio": sus citas pendientes o confirmadas, en cualquier momento.
 * Devuelve el reembolso, o lanza CitaNoModificable con el motivo (o null si la cita no es suya).
 */
export async function cancelarCita(
  db: SqlTx,
  { appointmentId, por, userId, ahora = new Date() }: { appointmentId: string; por: "cliente" | "negocio"; userId: string; ahora?: Date },
) {
  const limite = por === "cliente" ? new Date(ahora.getTime() + PLAZO_CLIENTE_MIN * 60_000) : new Date(0);
  const esCliente = por === "cliente";
  const [resultado] = (await db`
    WITH cancelada AS (
      UPDATE stylehub_client_appointments
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = ${appointmentId}::uuid
        AND (CASE WHEN ${esCliente}::boolean THEN client_user_id ELSE business_user_id END) = ${userId}::uuid
        AND status IN ('pending', 'confirmed')
        AND scheduled_at > ${limite.toISOString()}::timestamptz
      RETURNING id, client_user_id, total_amount, payment_provider
    ),
    devolucion AS (
      UPDATE stylehub_client_wallets w
      SET balance = w.balance + c.total_amount, updated_at = NOW()
      FROM cancelada c
      WHERE w.user_id = c.client_user_id AND c.payment_provider = 'wallet' AND c.total_amount > 0
      RETURNING w.id AS wallet_id, c.id AS appointment_id, c.client_user_id, c.total_amount
    ),
    movimiento AS (
      INSERT INTO stylehub_client_wallet_transactions
        (wallet_id, user_id, transaction_type, amount, payment_provider, status, notes, appointment_id)
      SELECT wallet_id, client_user_id, 'refund', total_amount, 'wallet', 'completed', 'Reembolso por cancelación', appointment_id
      FROM devolucion
      RETURNING amount
    )
    SELECT (SELECT count(*) FROM cancelada)::int AS canceladas, (SELECT COALESCE(sum(amount), 0) FROM movimiento) AS reembolso
  `) as Array<{ canceladas: number; reembolso: string }>;

  if (resultado.canceladas === 1) return { reembolso: Number(resultado.reembolso) };

  // No se canceló: explicar por qué (o 404 si no es suya)
  const [cita] = (await db`
    SELECT status, scheduled_at FROM stylehub_client_appointments
    WHERE id = ${appointmentId}::uuid
      AND (CASE WHEN ${esCliente}::boolean THEN client_user_id ELSE business_user_id END) = ${userId}::uuid
    LIMIT 1
  `) as Array<{ status: string; scheduled_at: string | Date }>;
  if (!cita) throw new CitaNoModificable("No encontramos esa cita.");
  if (!["pending", "confirmed"].includes(cita.status)) throw new CitaNoModificable("Solo se pueden cancelar citas pendientes o confirmadas.");
  throw new CitaNoModificable("Solo puedes cancelar hasta 2 horas antes de la cita. Comunícate con el negocio.");
}

/**
 * Reagenda una cita del cliente a otro horario libre (hasta PLAZO_CLIENTE_MIN antes de la cita actual).
 * Mismo servicio y precio; conserva al estilista si está libre, o el elegido, o el de menos carga.
 */
export async function reagendarCita(
  db: SqlTx,
  d: { appointmentId: string; clienteId: string; nuevoInicio: Date; stylistId: string | null; ahora?: Date },
) {
  const ahora = d.ahora ?? new Date();
  const [cita] = (await db`
    SELECT id, client_user_id, business_user_id, branch_id, service_id, stylist_id, status, scheduled_at
    FROM stylehub_client_appointments
    WHERE id = ${d.appointmentId}::uuid AND client_user_id = ${d.clienteId}::uuid
    LIMIT 1
  `) as CitaActual[];
  if (!cita) throw new CitaNoModificable("No encontramos esa cita en tu cuenta.");
  if (!["pending", "confirmed"].includes(cita.status)) throw new CitaNoModificable("Solo puedes reagendar citas pendientes o confirmadas.");
  if (new Date(cita.scheduled_at).getTime() <= ahora.getTime() + PLAZO_CLIENTE_MIN * 60_000) {
    throw new CitaNoModificable("Solo puedes reagendar hasta 2 horas antes de la cita. Comunícate con el negocio.");
  }
  if (!cita.service_id) throw new CitaNoModificable("Esta cita no tiene un servicio asociado; comunícate con el negocio.");

  const servicio = await servicioReservable(db, { businessUserId: cita.business_user_id, branchId: cita.branch_id, serviceId: cita.service_id });
  const fin = new Date(d.nuevoInicio.getTime() + servicio.duration_minutes * 60_000);
  const fecha = fechaLocal(d.nuevoInicio);
  const ids = await estilistasCandidatos(db, { ...cita, businessUserId: cita.business_user_id, branchId: cita.branch_id, serviceId: cita.service_id, stylistId: d.stylistId });
  const agenda = await agendaDelDia(db, ids, fecha, ZONA_HORARIA, cita.id);
  const horario = horariosLibres({ fecha, duracionMin: servicio.duration_minutes, estilistas: agenda, ahora })
    .find((h) => h.inicio.getTime() === d.nuevoInicio.getTime());
  if (!horario) throw new HorarioNoDisponible();

  const orden = porCarga(horario.estilistas, agenda.carga);
  if (cita.stylist_id && orden.includes(cita.stylist_id)) orden.unshift(...orden.splice(orden.indexOf(cita.stylist_id), 1));

  for (const stylistId of orden) {
    try {
      const [, filas] = await db.begin((tx) => [
        candado(tx, stylistId),
        tx`
          UPDATE stylehub_client_appointments
          SET scheduled_at = ${d.nuevoInicio.toISOString()}::timestamptz, ends_at = ${fin.toISOString()}::timestamptz,
              stylist_id = ${stylistId}::uuid, updated_at = NOW()
          WHERE id = ${cita.id}::uuid AND status IN ('pending', 'confirmed')
            AND NOT EXISTS (
              SELECT 1 FROM stylehub_client_appointments o
              WHERE o.stylist_id = ${stylistId}::uuid AND o.id <> ${cita.id}::uuid AND o.status <> 'cancelled'
                AND o.scheduled_at < ${fin.toISOString()}::timestamptz AND o.ends_at > ${d.nuevoInicio.toISOString()}::timestamptz
            )
            AND NOT EXISTS (
              SELECT 1 FROM stylehub_stylist_absences x
              WHERE x.stylist_id = ${stylistId}::uuid
                AND x.starts_at < ${fin.toISOString()}::timestamptz AND x.ends_at > ${d.nuevoInicio.toISOString()}::timestamptz
            )
          RETURNING id, scheduled_at, ends_at, stylist_id
        `,
      ]);
      const [fila] = filas as Array<Record<string, unknown>>;
      if (fila) return fila;
    } catch (error) {
      if ((error as { code?: string }).code !== VIOLACION_DE_EXCLUSION) throw error;
    }
  }
  throw new HorarioNoDisponible();
}
