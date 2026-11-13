import type { Sql } from "@/lib/booking";

export type Monedero = { id: string; balance: string; currency: string };

/**
 * Recarga ya cobrada (modo simulado o cargo directo a tarjeta): suma al saldo y registra el movimiento en UNA sola
 * sentencia. Si el registro falla, el saldo tampoco cambia. Devuelve el monedero actualizado.
 */
export async function recargaCompletada(
  db: Sql,
  d: {
    walletId: string;
    userId: string;
    monto: number;
    paymentMethodId: string | null;
    proveedor: "mock" | "stripe";
    referencia: string | null;
    notas: string;
  },
): Promise<Monedero> {
  const [monedero] = (await db`
    WITH saldo AS (
      UPDATE stylehub_client_wallets
      SET balance = balance + ${d.monto}::numeric, updated_at = NOW()
      WHERE id = ${d.walletId}::uuid
      RETURNING id, balance, currency
    ),
    movimiento AS (
      INSERT INTO stylehub_client_wallet_transactions (
        wallet_id, user_id, transaction_type, amount, payment_method_id, payment_provider, status,
        external_reference, notes
      )
      SELECT saldo.id, ${d.userId}::uuid, 'recharge', ${d.monto}::numeric, ${d.paymentMethodId}::uuid,
        ${d.proveedor}::text, 'completed', ${d.referencia}::text, ${d.notas}::text
      FROM saldo
      RETURNING id
    )
    SELECT id, balance, currency FROM saldo
  `) as Monedero[];
  return monedero;
}

/**
 * Recarga pendiente de Checkout que Stripe ya cobró: la marca como completada y suma su monto al saldo en UNA sola
 * sentencia (o las dos cosas o ninguna). Solo actúa si sigue pendiente, así que la confirmación al volver de
 * Checkout y el webhook pueden llegar a la vez y se acredita una sola vez. Con userId, solo si es de esa persona.
 * Devuelve el movimiento acreditado, o undefined si ya estaba completado (o no existe).
 */
export async function acreditarRecargaPendiente(
  db: Sql,
  d: { txId: string; userId: string | null; sessionId: string; nota: string },
) {
  const [acreditada] = (await db`
    WITH liquidada AS (
      UPDATE stylehub_client_wallet_transactions
      SET status = 'completed',
          external_reference = ${d.sessionId}::text,
          notes = COALESCE(notes, ${d.nota}::text)
      WHERE id = ${d.txId}::uuid
        AND (${d.userId}::uuid IS NULL OR user_id = ${d.userId}::uuid)
        AND status = 'pending'
      RETURNING id, wallet_id, user_id, amount
    ),
    saldo AS (
      UPDATE stylehub_client_wallets w
      SET balance = w.balance + l.amount, updated_at = NOW()
      FROM liquidada l
      WHERE w.id = l.wallet_id
      RETURNING w.id
    )
    SELECT l.id, l.wallet_id, l.user_id, l.amount FROM liquidada l
  `) as Array<{ id: string; wallet_id: string; user_id: string; amount: string }>;
  return acreditada;
}
