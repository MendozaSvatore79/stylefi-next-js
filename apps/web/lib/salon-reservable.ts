/**
 * Si un salón del catálogo se puede reservar (campo "reservable" de GET /businesses). Un salón sin estilistas con
 * horario se muestra con "Aún sin horarios" y sin el botón de reservar (decisión de Eric, 2026-11-25). Si el backend
 * no manda el campo (versión anterior), se asume que sí, como antes.
 */
export function esReservable(salon: { reservable?: boolean } | null | undefined): boolean {
  return salon?.reservable !== false;
}
