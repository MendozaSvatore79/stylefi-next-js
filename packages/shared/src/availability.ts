/**
 * Horarios libres para reservar (función pura, sin base de datos; traducida del motor de la Agenda).
 *
 * Un horario es libre para un estilista si:
 * - el servicio cabe completo dentro de uno de sus bloques del día (no cruza el descanso);
 * - empieza en un múltiplo de PASO_MIN contado desde el inicio del bloque;
 * - no se encima con una cita que ocupe horario ni con una ausencia;
 * - empieza al menos ANTICIPACION_MIN después de ahora, y el día está entre hoy y HORIZONTE_DIAS.
 * Todo se calcula en la zona horaria del negocio, sin depender de la zona del servidor.
 */
export const PASO_MIN = 15;
export const ANTICIPACION_MIN = 60;
export const HORIZONTE_DIAS = 30;
export const ZONA_HORARIA = "America/Mexico_City";
export const DURACION_POR_DEFECTO = 30; // servicios sin duración, igual que antes

export type Bloque = { dayOfWeek: number; start: string; end: string }; // 0 = lunes; "HH:MM" o "HH:MM:SS"
export type Intervalo = { start: Date; end: Date };
export type EstilistaDelDia = { id: string; bloques: Bloque[]; ocupado: Intervalo[] };
export type HorarioLibre = { inicio: Date; estilistas: string[] };

const MINUTO = 60_000;

function partesEnZona(fecha: Date, zona: string) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: zona,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(fecha);
  const v = (t: string) => Number(partes.find((p) => p.type === t)?.value);
  return { y: v("year"), m: v("month"), d: v("day"), h: v("hour"), mi: v("minute"), s: v("second") };
}

/** Diferencia en ms entre la hora de pared en la zona y UTC, para ese instante. */
function desfase(instante: Date, zona: string) {
  const p = partesEnZona(instante, zona);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(instante.getTime() / 1000) * 1000;
}

/** "2030-01-07" + "10:30" en la zona → instante UTC. Funciona también en zonas con horario de verano. */
export function horaLocalAUtc(fecha: string, hora: string, zona = ZONA_HORARIA): Date {
  const [y, m, d] = fecha.split("-").map(Number);
  const [h, mi] = hora.split(":").map(Number);
  const pared = Date.UTC(y, m - 1, d, h, mi);
  let utc = pared - desfase(new Date(pared), zona);
  utc = pared - desfase(new Date(utc), zona); // segunda pasada por si cambió el desfase
  return new Date(utc);
}

/** Instante → "AAAA-MM-DD" en la zona. */
export function fechaLocal(instante: Date, zona = ZONA_HORARIA): string {
  const p = partesEnZona(instante, zona);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

/** Instante → "HH:MM" en la zona. */
export function horaLocal(instante: Date, zona = ZONA_HORARIA): string {
  const p = partesEnZona(instante, zona);
  return `${String(p.h).padStart(2, "0")}:${String(p.mi).padStart(2, "0")}`;
}

export function esFecha(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [y, m, d] = valor.split("-").map(Number);
  const f = new Date(Date.UTC(y, m - 1, d));
  return f.getUTCFullYear() === y && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

/** 0 = lunes … 6 = domingo, para una fecha de calendario. */
export function diaDeLaSemana(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

function sumarDias(fecha: string, dias: number) {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

export function fechaPermitida(fecha: string, ahora: Date, zona = ZONA_HORARIA): boolean {
  const hoy = fechaLocal(ahora, zona);
  return esFecha(fecha) && fecha >= hoy && fecha <= sumarDias(hoy, HORIZONTE_DIAS);
}

/** Inicio y fin (UTC) del día de calendario en la zona, para buscar citas y ausencias que lo tocan. */
export function limitesDelDia(fecha: string, zona = ZONA_HORARIA): Intervalo {
  return { start: horaLocalAUtc(fecha, "00:00", zona), end: horaLocalAUtc(sumarDias(fecha, 1), "00:00", zona) };
}

export function horariosLibres(args: {
  fecha: string;
  duracionMin: number;
  estilistas: EstilistaDelDia[];
  ahora: Date;
  zona?: string;
}): HorarioLibre[] {
  const { fecha, duracionMin, estilistas, ahora, zona = ZONA_HORARIA } = args;
  if (!fechaPermitida(fecha, ahora, zona) || !(duracionMin > 0)) return [];
  const dia = diaDeLaSemana(fecha);
  const minimo = ahora.getTime() + ANTICIPACION_MIN * MINUTO;
  const duracion = duracionMin * MINUTO;
  const libres = new Map<number, string[]>();

  for (const e of estilistas) {
    for (const b of e.bloques.filter((x) => x.dayOfWeek === dia)) {
      const finBloque = horaLocalAUtc(fecha, b.end, zona).getTime();
      for (let t = horaLocalAUtc(fecha, b.start, zona).getTime(); t + duracion <= finBloque; t += PASO_MIN * MINUTO) {
        if (t < minimo) continue;
        const choca = e.ocupado.some((o) => t < o.end.getTime() && o.start.getTime() < t + duracion);
        if (!choca) libres.set(t, [...(libres.get(t) ?? []), e.id]);
      }
    }
  }
  return [...libres.entries()].sort(([a], [b]) => a - b).map(([t, ids]) => ({ inicio: new Date(t), estilistas: ids }));
}
