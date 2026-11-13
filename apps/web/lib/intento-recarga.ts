/**
 * Clave por intento de recarga (la usa el servidor como clave de idempotencia de Stripe): se conserva mientras la
 * persona reintenta la MISMA recarga (mismo monto y misma tarjeta) y cambia si cambia el monto o la tarjeta. La
 * página la descarta cuando la recarga terminó (completada, en proceso o abierta en Checkout).
 */
export type Intento = { id: string; firma: string };

export function intentoDeRecarga(actual: Intento | null, amount: number, paymentMethodId: string, nuevoId: () => string = () => crypto.randomUUID()): Intento {
  const firma = `${amount.toFixed(2)}|${paymentMethodId}`;
  return actual && actual.firma === firma ? actual : { id: nuevoId(), firma };
}

/** Estado de un movimiento del monedero, en el idioma de la pantalla. */
export function estadoDeMovimiento(t: { status: string; cobro_directo?: boolean }, language: string) {
  const es = language !== "en";
  if (t.status === "completed") return es ? "Completada" : "Completed";
  if (t.status === "failed") return es ? "No se cobró" : "Not charged";
  if (t.status === "pending") {
    // Cobro directo ya enviado a Stripe: se completa solo. Checkout sin terminar: la persona no pagó.
    if (t.cobro_directo) return es ? "En proceso" : "Processing";
    return es ? "Pago sin completar" : "Payment not completed";
  }
  return t.status;
}
