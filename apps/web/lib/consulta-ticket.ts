/** Cada cuánto el widget de soporte vuelve a consultar el ticket: 5 s abierto, 15 s cerrado. */
export const CONSULTA_ABIERTO_MS = 5000;
export const CONSULTA_CERRADO_MS = 15000;

/**
 * Milisegundos entre consultas del ticket, o null si no hay que sondearlo: con el ticket cerrado no hay intervalo
 * ni consulta al regresar a la pestaña (el widget lo consulta solo al montarse y al abrirse o cerrarse).
 */
export function intervaloDeConsulta(estado: string | null, widgetAbierto: boolean): number | null {
  if (estado === "closed") return null;
  return widgetAbierto ? CONSULTA_ABIERTO_MS : CONSULTA_CERRADO_MS;
}
