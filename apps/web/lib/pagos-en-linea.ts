/**
 * Pagos en línea (Stripe): recargas del monedero y tarjetas. Mientras no estén activos (decisión de producto), la
 * pantalla de Pagos no ofrece recargar ni guardar tarjetas y muestra este aviso; se sigue pagando en el salón.
 */
export const AVISO_PAGOS = {
  es: "Los pagos en línea llegarán pronto. Por ahora pagas en el salón.",
  en: "Online payments are coming soon. For now, you pay at the salon.",
};

/**
 * Lo que dice el backend en GET /client/payment-methods. Con la llave pública de Stripe configurada, los pagos en
 * línea y recargas con Stripe están habilitados.
 */
export function pagosEnLineaDe(respuesta: { pagosEnLinea?: unknown }): boolean {
  if (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()) {
    return true;
  }
  return respuesta.pagosEnLinea !== false;
}
