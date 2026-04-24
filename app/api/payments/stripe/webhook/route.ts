import { NextResponse } from "next/server";
import Stripe from "stripe";

import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";
import { getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await ensureStylehubSchema();
    const db = getDb();

    const signature = request.headers.get("stripe-signature");
    if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Webhook signature inválida." }, { status: 400 });
    }

    const stripe = getStripeClient();
    const rawBody = await request.text();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (error) {
      console.error("Stripe signature error", error);
      return NextResponse.json({ error: "Firma de webhook inválida." }, { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const walletTransactionId = session.metadata?.walletTransactionId;

      if (walletTransactionId) {
        const updatedTx = (await db`
          UPDATE stylehub_client_wallet_transactions
          SET status = 'completed',
              external_reference = ${session.id},
              notes = COALESCE(notes, 'Recarga confirmada por Stripe')
          WHERE id = ${walletTransactionId}
            AND status = 'pending'
          RETURNING wallet_id, amount, user_id
        `) as Array<{ wallet_id: string; amount: string; user_id: string }>;

        if (updatedTx.length > 0) {
          const tx = updatedTx[0];
          await db`
            UPDATE stylehub_client_wallets
            SET balance = balance + ${tx.amount},
                updated_at = NOW()
            WHERE id = ${tx.wallet_id}
          `;

          const paymentIntentId =
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id || null;

          if (paymentIntentId) {
            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
              expand: ["payment_method"],
            });

            const paymentMethod = paymentIntent.payment_method;
            if (paymentMethod && typeof paymentMethod !== "string" && paymentMethod.type === "card") {
              const tokenReference = paymentMethod.id;
              const cardBrand = paymentMethod.card?.brand || null;
              const cardLast4 = paymentMethod.card?.last4 || null;
              const holderName = paymentMethod.billing_details?.name || null;

              const existing = (await db`
                SELECT id
                FROM stylehub_client_payment_methods
                WHERE user_id = ${tx.user_id}
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
                    ${tx.user_id},
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

              if (typeof session.customer === "string") {
                await db`
                  UPDATE stylehub_users
                  SET stripe_customer_id = COALESCE(stripe_customer_id, ${session.customer}),
                      updated_at = NOW()
                  WHERE id = ${tx.user_id}
                `;
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo procesar webhook de Stripe." }, { status: 500 });
  }
}
