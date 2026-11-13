/**
 * Cobro directo a una tarjeta guardada, sin cobrar dos veces (igual que synova-backend, src/pagos/cobro-directo.ts):
 * - la recarga se registra como pendiente ANTES de cobrar, con una clave por intento (requestId del navegador);
 * - Stripe recibe esa clave como clave de idempotencia: el mismo intento nunca genera un segundo cargo;
 * - si Stripe cobró pero no se pudo sumar el saldo, NO se abre Checkout: la recarga queda «En proceso» y se completa
 *   sola (reintento inmediato, y otra vez cada vez que la persona abre Pagos: reconciliarRecargas).
 * Solo cuando Stripe dice con certeza que no cobró (tarjeta rechazada, pide autenticación, petición inválida) la
 * recarga queda como «failed» y se abre Checkout, como antes.
 */
import { randomUUID } from "node:crypto";

import type postgres from "postgres";
import type Stripe from "stripe";

import type { Sql } from "@/lib/booking";
import { acreditarRecargaPendiente } from "@/lib/recargas";

/** Solo la parte de Stripe que se usa aquí (las pruebas pasan una falsa). */
export type CobrosStripe = { paymentIntents: Pick<Stripe["paymentIntents"], "create"> };

export type ResultadoCobro = "acreditada" | "en-proceso" | "no-cobrada";

type Fila = { id: string; status: string; amount: string };

/** Lo que ve la persona si Stripe cobró pero el saldo todavía no se sumó. */
export function mensajeEnProceso(monto: number) {
  return `Recibimos tu pago de $${monto.toFixed(2)}. Lo estamos sumando a tu saldo y aparecerá en unos minutos. No se te volverá a cobrar.`;
}

/** Ya existe una recarga con esta clave por otro monto (el navegador cambia la clave si cambia el monto). */
export class RecargaDistinta extends Error {
  constructor() {
    super("Esta recarga ya se inició con otro monto. Recarga la página e inténtalo de nuevo.");
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Clave del intento: la del navegador si es válida; si no (versión anterior de la página), una nueva. */
export function claveDeRecarga(userId: string, requestId: unknown) {
  const id = typeof requestId === "string" && UUID.test(requestId.trim()) ? requestId.trim().toLowerCase() : randomUUID();
  return `recarga-${userId}-${id}`;
}

/**
 * Ejecuta fn con un candado de PostgreSQL por `clave` en una conexión reservada; fn recibe el sql de esa misma
 * conexión (así el candado ocupa una sola conexión). Otra llamada con la misma clave, en cualquier instancia, espera.
 * Si no se pudiera soltar, el candado se suelta solo cuando la conexión se cierra (idle_timeout).
 */
export async function conCandado<R>(db: postgres.Sql, clave: string, fn: (sql: Sql) => Promise<R>): Promise<R> {
  const reservada = await db.reserve();
  try {
    await reservada`SELECT pg_advisory_lock(hashtextextended(${clave}::text, 0))`;
    try {
      return await fn(reservada as unknown as Sql);
    } finally {
      await reservada`SELECT pg_advisory_unlock(hashtextextended(${clave}::text, 0))`.catch(() => undefined);
    }
  } finally {
    reservada.release();
  }
}

/** Los mismos parámetros siempre para la misma recarga (Stripe exige que coincidan al repetir la clave). */
function parametrosDelCobro(d: {
  monto: number;
  customerId: string;
  tokenTarjeta: string;
  userId: string;
  walletId: string;
  txId: string;
}): Stripe.PaymentIntentCreateParams {
  return {
    amount: Math.round(d.monto * 100),
    currency: "mxn",
    customer: d.customerId,
    payment_method: d.tokenTarjeta,
    off_session: true,
    confirm: true,
    metadata: { userId: d.userId, walletId: d.walletId, walletTransactionId: d.txId },
  };
}

const esperar = (ms: number) => new Promise((listo) => setTimeout(listo, ms));

/** Suma la recarga cobrada, con reintentos silenciosos (casi todas las fallas de la base son momentáneas). */
async function acreditarConReintentos(sql: Sql, d: { txId: string; userId: string; clave: string }, intentos = 3) {
  let ultimo: unknown;
  for (let i = 0; i < intentos; i++) {
    try {
      return await acreditarRecargaPendiente(sql, { txId: d.txId, userId: d.userId, sessionId: d.clave, nota: "Recarga con tarjeta guardada" });
    } catch (error) {
      ultimo = error;
      if (i < intentos - 1) await esperar(200 * (i + 1));
    }
  }
  throw ultimo;
}

const marcarNoCobrada = (sql: Sql, txId: string) =>
  sql`UPDATE stylehub_client_wallet_transactions SET status = 'failed' WHERE id = ${txId}::uuid AND status = 'pending'`;

/** Cobra (o vuelve a preguntar por) una recarga pendiente y la acredita si Stripe cobró. */
async function cobrarPendiente(
  sql: Sql,
  stripe: CobrosStripe,
  d: { txId: string; userId: string; clave: string; parametros: Stripe.PaymentIntentCreateParams },
): Promise<ResultadoCobro> {
  let intent: Stripe.PaymentIntent;
  try {
    intent = await stripe.paymentIntents.create(d.parametros, { idempotencyKey: d.clave });
  } catch (error) {
    const tipo = (error as { type?: string }).type;
    if (tipo === "StripeCardError" || tipo === "StripeInvalidRequestError") {
      // Stripe respondió que no cobró: se puede abrir Checkout
      console.log("Direct charge failed, falling back to checkout:", error);
      await marcarNoCobrada(sql, d.txId);
      return "no-cobrada";
    }
    // Sin respuesta clara (red, error de Stripe): pudo cobrarse; se resuelve después con la misma clave
    console.error("Cobro directo sin respuesta clara; queda en proceso:", error);
    return "en-proceso";
  }

  if (intent.status === "succeeded") {
    try {
      await acreditarConReintentos(sql, d);
      return "acreditada";
    } catch (error) {
      console.error("Stripe cobró pero no se pudo sumar el saldo; queda en proceso:", error);
      return "en-proceso";
    }
  }
  if (intent.status === "processing") return "en-proceso";

  // requires_action, requires_payment_method, canceled…: no se cobró
  console.log(`Direct charge intent status: ${intent.status}, falling back to checkout`);
  await marcarNoCobrada(sql, d.txId);
  return "no-cobrada";
}

/**
 * Cobro directo de una recarga a una tarjeta guardada. Registra (o encuentra, si es un reintento) la recarga
 * pendiente con su clave y la cobra, todo bajo un candado por clave: un reintento simultáneo espera y ve el
 * resultado del primero.
 */
export async function cobroDirecto(
  db: postgres.Sql,
  stripe: CobrosStripe,
  d: {
    userId: string;
    walletId: string;
    monto: number;
    metodo: { id: string; token: string };
    customerId: string;
    requestId: unknown;
    notas: string;
  },
): Promise<ResultadoCobro> {
  const clave = claveDeRecarga(d.userId, d.requestId);
  return conCandado(db, clave, async (sql) => {
    const [existente] = (await sql`
      SELECT id, status, amount FROM stylehub_client_wallet_transactions
      WHERE user_id = ${d.userId}::uuid AND external_reference = ${clave}::text
      LIMIT 1
    `) as Fila[];
    if (existente && Math.abs(Number(existente.amount) - d.monto) >= 0.01) throw new RecargaDistinta();
    if (existente?.status === "completed") return "acreditada";
    if (existente?.status === "failed") return "no-cobrada";

    const tx =
      existente ??
      ((await sql`
        INSERT INTO stylehub_client_wallet_transactions (
          wallet_id, user_id, transaction_type, amount, payment_method_id, payment_provider, status,
          external_reference, notes
        )
        VALUES (
          ${d.walletId}::uuid, ${d.userId}::uuid, 'recharge', ${d.monto}::numeric, ${d.metodo.id}::uuid, 'stripe',
          'pending', ${clave}::text, ${d.notas}::text
        )
        RETURNING id, status, amount
      `) as Fila[])[0];

    return cobrarPendiente(sql, stripe, {
      txId: tx.id,
      userId: d.userId,
      clave,
      parametros: parametrosDelCobro({
        // El monto guardado (numeric, 2 decimales): el mismo que usa la reconciliación y el que se acredita
        monto: Number(tx.amount),
        customerId: d.customerId,
        tokenTarjeta: d.metodo.token,
        userId: d.userId,
        walletId: d.walletId,
        txId: tx.id,
      }),
    });
  });
}

/**
 * Completa las recargas «En proceso» de la persona (cobros directos de las últimas 23 horas: Stripe recuerda la
 * clave 24). Pregunta a Stripe con la misma clave y los mismos datos, así que no cobra de nuevo. Nunca lanza: si algo
 * falla, la recarga sigue en proceso y se vuelve a intentar la próxima vez.
 */
export async function reconciliarRecargas(db: postgres.Sql, stripe: CobrosStripe, userId: string) {
  try {
    const pendientes = (await db`
      SELECT t.id, t.amount, t.external_reference AS clave, t.wallet_id, m.token_reference AS token,
        u.stripe_customer_id AS customer_id
      FROM stylehub_client_wallet_transactions t
      JOIN stylehub_client_payment_methods m ON m.id = t.payment_method_id
      JOIN stylehub_users u ON u.id = t.user_id
      WHERE t.user_id = ${userId}::uuid AND t.status = 'pending' AND t.payment_provider = 'stripe'
        AND t.external_reference LIKE 'recarga-%'
        AND t.created_at > NOW() - interval '23 hours'
        AND m.token_reference IS NOT NULL AND u.stripe_customer_id IS NOT NULL
    `) as Array<{ id: string; amount: string; clave: string; wallet_id: string; token: string; customer_id: string }>;
    for (const p of pendientes) {
      await conCandado(db, p.clave, async (sql) => {
        // Puede haberse resuelto mientras se esperaba el candado
        const [sigue] = await sql`SELECT 1 FROM stylehub_client_wallet_transactions WHERE id = ${p.id}::uuid AND status = 'pending'`;
        if (!sigue) return;
        await cobrarPendiente(sql, stripe, {
          txId: p.id,
          userId,
          clave: p.clave,
          parametros: parametrosDelCobro({
            monto: Number(p.amount),
            customerId: p.customer_id,
            tokenTarjeta: p.token,
            userId,
            walletId: p.wallet_id,
            txId: p.id,
          }),
        });
      });
    }
  } catch (error) {
    console.error("No se pudieron revisar las recargas en proceso:", error);
  }
}
