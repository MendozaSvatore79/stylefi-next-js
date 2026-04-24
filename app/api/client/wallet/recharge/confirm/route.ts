import { NextResponse } from "next/server";
import Stripe from "stripe";

import { getCurrentClientUser } from "@/app/api/client/_current-user";
import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";
import { getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await getCurrentClientUser();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    await ensureStylehubSchema();

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Stripe no configurado en servidor." }, { status: 400 });
    }

    const payload = (await request.json()) as { sessionId?: string };
    const sessionId = payload.sessionId?.trim();

    if (!sessionId || !sessionId.startsWith("cs_")) {
      return NextResponse.json({ error: "sessionId inválido." }, { status: 400 });
    }

    const stripe = getStripeClient();
    const db = getDb();

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent.payment_method"],
    });

    if (session.mode !== "payment") {
      return NextResponse.json({ error: "Sesión Stripe inválida para recarga." }, { status: 400 });
    }

    if (session.payment_status !== "paid") {
      return NextResponse.json({ error: "El pago todavía no está confirmado por Stripe." }, { status: 400 });
    }

    const walletTransactionId = session.metadata?.walletTransactionId ?? null;

    const txById = walletTransactionId
      ? ((await db`
          SELECT id, wallet_id, user_id, amount, status
          FROM stylehub_client_wallet_transactions
          WHERE id = ${walletTransactionId}
            AND user_id = ${auth.userId}
          LIMIT 1
        `) as Array<{ id: string; wallet_id: string; user_id: string; amount: string; status: string }>)
      : [];

    const txBySession = txById.length
      ? txById
      : ((await db`
          SELECT id, wallet_id, user_id, amount, status
          FROM stylehub_client_wallet_transactions
          WHERE external_reference = ${session.id}
            AND user_id = ${auth.userId}
          ORDER BY created_at DESC
          LIMIT 1
        `) as Array<{ id: string; wallet_id: string; user_id: string; amount: string; status: string }>);

    const tx = txBySession[0];

    if (!tx) {
      return NextResponse.json({ error: "No se encontró la recarga asociada a esta sesión." }, { status: 404 });
    }

    if (tx.status === "completed") {
      return NextResponse.json({ ok: true, completed: true, alreadyCompleted: true }, { status: 200 });
    }

    const updatedTx = (await db`
      UPDATE stylehub_client_wallet_transactions
      SET status = 'completed',
          external_reference = ${session.id},
          notes = COALESCE(notes, 'Recarga confirmada desde retorno de checkout')
      WHERE id = ${tx.id}
        AND user_id = ${auth.userId}
        AND status = 'pending'
      RETURNING id, wallet_id, user_id, amount
    `) as Array<{ id: string; wallet_id: string; user_id: string; amount: string }>;

    if (updatedTx.length === 0) {
      return NextResponse.json({ ok: true, completed: true, alreadyCompleted: true }, { status: 200 });
    }

    const settledTx = updatedTx[0];

    await db`
      UPDATE stylehub_client_wallets
      SET balance = balance + ${settledTx.amount},
          updated_at = NOW()
      WHERE id = ${settledTx.wallet_id}
    `;

    const paymentIntent =
      session.payment_intent && typeof session.payment_intent !== "string"
        ? session.payment_intent
        : null;
    const paymentMethod = paymentIntent?.payment_method;

    if (paymentMethod && typeof paymentMethod !== "string" && paymentMethod.type === "card") {
      const tokenReference = paymentMethod.id;
      const cardBrand = paymentMethod.card?.brand || null;
      const cardLast4 = paymentMethod.card?.last4 || null;
      const holderName = paymentMethod.billing_details?.name || null;

      const existing = (await db`
        SELECT id
        FROM stylehub_client_payment_methods
        WHERE user_id = ${auth.userId}
          AND token_reference = ${tokenReference}
        LIMIT 1
      `) as Array<{ id: string }>;

      if (existing.length === 0) {
        await db`
          INSERT INTO stylehub_client_payment_methods (
            user_id,
            provider,
            card_brand,
            card_last4,
            holder_name,
            token_reference,
            is_default,
            updated_at
          )
          VALUES (
            ${auth.userId},
            'card',
            ${cardBrand},
            ${cardLast4},
            ${holderName},
            ${tokenReference},
            FALSE,
            NOW()
          )
        `;
      }
    }

    if (typeof session.customer === "string") {
      await db`
        UPDATE stylehub_users
        SET stripe_customer_id = COALESCE(stripe_customer_id, ${session.customer}),
            updated_at = NOW()
        WHERE id = ${auth.userId}
      `;
    }

    return NextResponse.json({ ok: true, completed: true, alreadyCompleted: false }, { status: 200 });
  } catch (error) {
    const stripeError = error as Stripe.StripeRawError;
    if (stripeError?.type === "invalid_request_error") {
      return NextResponse.json({ error: "No se pudo validar la sesión con Stripe." }, { status: 400 });
    }

    console.error(error);
    return NextResponse.json({ error: "No se pudo confirmar la recarga." }, { status: 500 });
  }
}
