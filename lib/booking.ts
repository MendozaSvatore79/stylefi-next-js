import {
  DURACION_POR_DEFECTO,
  type EstilistaDelDia,
  type HorarioLibre,
  horariosLibres,
  limitesDelDia,
  ZONA_HORARIA,
} from "@/lib/availability";

/** Función de consulta con plantillas (la de @neondatabase/serverless o una transacción). */
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

/** Bloques del día y tiempo ocupado (citas que no están canceladas y ausencias) de cada estilista. */
export async function agendaDelDia(db: Sql, ids: string[], fecha: string, zona = ZONA_HORARIA): Promise<EstilistaDelDia[]> {
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
  return ids.map((id) => ({
    id,
    bloques: bloques
      .filter((b) => b.stylist_id === id)
      .map((b) => ({ dayOfWeek: Number(b.day_of_week), start: b.start_time, end: b.end_time })),
    ocupado: [
      ...citas.filter((c) => c.stylist_id === id).map((c) => ({ start: new Date(c.scheduled_at), end: new Date(c.ends_at) })),
      ...ausencias.filter((a) => a.stylist_id === id).map((a) => ({ start: new Date(a.starts_at), end: new Date(a.ends_at) })),
    ],
  }));
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
