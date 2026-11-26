import { cierrePendiente } from "@stylefi/shared";

/**
 * Citas por cerrar (decisión de producto, 2026-11-19; los 7 días, 2026-11-25): las pendientes o confirmadas cuya
 * hora ya pasó no cambian solas de estado; las cierra el negocio (completada o no asistió). Se le piden durante 7
 * días; después se muestran como "Pasada sin confirmar" y aún se pueden cerrar. Regla en cierrePendiente (shared).
 */
type CitaConEstado = { scheduled_at: string; status: string };

/** Pasó hace 7 días o menos y sigue abierta: se le pide al negocio que la cierre. */
export function esPorCerrar(cita: CitaConEstado, ahora = Date.now()) {
  return cierrePendiente(cita, new Date(ahora)) === "por-cerrar";
}

/** Pasó hace más de 7 días y sigue abierta: "Pasada sin confirmar". */
export function esSinConfirmar(cita: CitaConEstado, ahora = Date.now()) {
  return cierrePendiente(cita, new Date(ahora)) === "sin-confirmar";
}

export function citasPorCerrar<T extends CitaConEstado>(citas: T[], ahora = Date.now()): T[] {
  return citas.filter((c) => esPorCerrar(c, ahora));
}

/** Aviso con el conteo de citas por cerrar (null si no hay), en singular o plural. */
export function avisoCitasPorCerrar(n: number, idioma: "es" | "en"): string | null {
  if (n <= 0) return null;
  if (idioma === "en") {
    return n === 1
      ? "You have 1 past appointment that is still open. Mark it as completed or no-show."
      : `You have ${n} past appointments that are still open. Mark them as completed or no-show.`;
  }
  return n === 1
    ? "Tienes 1 cita que ya pasó y sigue abierta. Márcala como completada o no asistió."
    : `Tienes ${n} citas que ya pasaron y siguen abiertas. Márcalas como completadas o no asistió.`;
}
