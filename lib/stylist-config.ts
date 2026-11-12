import { horaLocalAUtc, ZONA_HORARIA } from "@/lib/availability";
import type { SqlTx } from "@/lib/booking";

/**
 * Configuración de cada estilista: servicios que hace, horario semanal por bloques y ausencias.
 * Todo se filtra por el negocio dueño del estilista (estilistaDelNegocio); lo ajeno «no existe».
 */
export class DatosInvalidos extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

export async function estilistaDelNegocio(db: SqlTx, businessUserId: string, stylistId: unknown): Promise<string | null> {
  if (typeof stylistId !== "string" || !UUID.test(stylistId)) return null;
  const [fila] = (await db`
    SELECT id FROM stylehub_business_stylists WHERE id = ${stylistId} AND business_user_id = ${businessUserId} LIMIT 1
  `) as Array<{ id: string }>;
  return fila?.id ?? null;
}

// --- Servicios que hace ---------------------------------------------------------------------

/** Valida que todos los servicios sean del negocio y devuelve la lista sin repetidos, o DatosInvalidos. */
export async function validarServiciosDelNegocio(db: SqlTx, businessUserId: string, serviceIds: unknown): Promise<string[]> {
  if (!Array.isArray(serviceIds) || !serviceIds.every((id) => typeof id === "string" && UUID.test(id))) {
    throw new DatosInvalidos("Lista de servicios inválida.");
  }
  const ids = [...new Set(serviceIds as string[])];
  const propios = (await db`
    SELECT id FROM stylehub_business_services WHERE business_user_id = ${businessUserId} AND id = ANY(${ids}::uuid[])
  `) as Array<{ id: string }>;
  if (propios.length !== ids.length) {
    throw new DatosInvalidos("Algún servicio no existe o no es de tu negocio.");
  }
  return ids;
}

/** Reemplaza los servicios del estilista (ya validados), en una transacción. */
export async function reemplazarServiciosDelEstilista(db: SqlTx, stylistId: string, ids: string[]) {
  await db.transaction([
    db`DELETE FROM stylehub_stylist_services WHERE stylist_id = ${stylistId}`,
    db`
      INSERT INTO stylehub_stylist_services (stylist_id, service_id)
      SELECT ${stylistId}::uuid, unnest(${ids}::uuid[])
    `,
  ]);
}

// --- Horario semanal ------------------------------------------------------------------------

export type BloqueEntrada = { dayOfWeek: number; start: string; end: string };

/** Valida y normaliza los bloques: día 0-6 (0 = lunes), "HH:MM", inicio antes que fin, sin encimarse. */
export function validarBloques(entrada: unknown): BloqueEntrada[] {
  if (!Array.isArray(entrada) || entrada.length > 70) throw new DatosInvalidos("Horario inválido.");
  const bloques = entrada.map((b) => {
    const { dayOfWeek, start, end } = (b ?? {}) as Record<string, unknown>;
    if (!Number.isInteger(dayOfWeek) || (dayOfWeek as number) < 0 || (dayOfWeek as number) > 6) {
      throw new DatosInvalidos("El día debe ser de 0 (lunes) a 6 (domingo).");
    }
    if (typeof start !== "string" || typeof end !== "string" || !HORA.test(start) || !HORA.test(end)) {
      throw new DatosInvalidos("Las horas deben tener el formato HH:MM.");
    }
    if (start >= end) throw new DatosInvalidos(`${DIAS[dayOfWeek as number]}: el bloque debe terminar después de empezar.`);
    return { dayOfWeek: dayOfWeek as number, start, end };
  });
  for (let dia = 0; dia < 7; dia++) {
    const delDia = bloques.filter((b) => b.dayOfWeek === dia).sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 1; i < delDia.length; i++) {
      if (delDia[i].start < delDia[i - 1].end) throw new DatosInvalidos(`${DIAS[dia]}: hay bloques que se enciman.`);
    }
  }
  return bloques;
}

export async function leerHorario(db: SqlTx, stylistId: string) {
  const filas = (await db`
    SELECT day_of_week, to_char(start_time, 'HH24:MI') AS start, to_char(end_time, 'HH24:MI') AS end
    FROM stylehub_stylist_schedule_blocks WHERE stylist_id = ${stylistId}
    ORDER BY day_of_week, start_time
  `) as Array<{ day_of_week: number; start: string; end: string }>;
  return filas.map((f) => ({ dayOfWeek: Number(f.day_of_week), start: f.start, end: f.end }));
}

/** Reemplaza el horario semanal completo, en una transacción. */
export async function guardarHorario(db: SqlTx, stylistId: string, bloques: BloqueEntrada[]) {
  await db.transaction([
    db`DELETE FROM stylehub_stylist_schedule_blocks WHERE stylist_id = ${stylistId}`,
    db`
      INSERT INTO stylehub_stylist_schedule_blocks (stylist_id, day_of_week, start_time, end_time)
      SELECT ${stylistId}::uuid, d, s, e
      FROM unnest(${bloques.map((b) => b.dayOfWeek)}::smallint[], ${bloques.map((b) => b.start)}::time[], ${bloques.map((b) => b.end)}::time[])
        AS t(d, s, e)
    `,
  ]);
}

// --- Ausencias ------------------------------------------------------------------------------

const MAX_AUSENCIA_DIAS = 90;
const FECHA_HORA_LOCAL = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/;

/** "2030-01-07T10:00" (hora del negocio, como la manda un input datetime-local) o ISO con zona → Date. */
export function fechaHoraDelNegocio(valor: unknown, zona = ZONA_HORARIA): Date | null {
  if (typeof valor !== "string") return null;
  const local = valor.match(FECHA_HORA_LOCAL);
  const fecha = local ? horaLocalAUtc(local[1], local[2], zona) : new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export function validarAusencia(entrada: { startsAt?: unknown; endsAt?: unknown; reason?: unknown }) {
  const inicio = fechaHoraDelNegocio(entrada.startsAt);
  const fin = fechaHoraDelNegocio(entrada.endsAt);
  if (!inicio || !fin) throw new DatosInvalidos("Indica desde y hasta cuándo.");
  if (inicio >= fin) throw new DatosInvalidos("La ausencia debe terminar después de empezar.");
  if (fin.getTime() - inicio.getTime() > MAX_AUSENCIA_DIAS * 86_400_000) {
    throw new DatosInvalidos("Una ausencia puede durar hasta 90 días; divídela si es más larga.");
  }
  const motivo = typeof entrada.reason === "string" ? entrada.reason.trim().slice(0, 120) || null : null;
  return { inicio, fin, motivo };
}
