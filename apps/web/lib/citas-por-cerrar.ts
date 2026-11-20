/**
 * Citas por cerrar (decisión de producto, 2026-11-19): las pendientes o confirmadas cuya hora ya pasó no cambian
 * solas de estado; las cierra el negocio (completada o no asistió) y la agenda le avisa cuántas tiene.
 * Misma regla que el backend para dejar marcarlas: a partir de la hora de la cita.
 */
type CitaConEstado = { scheduled_at: string; status: string };

export function esPorCerrar(cita: CitaConEstado, ahora = Date.now()) {
  return (cita.status === "pending" || cita.status === "confirmed") && new Date(cita.scheduled_at).getTime() <= ahora;
}

export function citasPorCerrar<T extends CitaConEstado>(citas: T[], ahora = Date.now()): T[] {
  return citas.filter((c) => esPorCerrar(c, ahora));
}

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
