import { NextResponse } from "next/server";
import Stripe from "stripe";

import { getCurrentClientUser } from "@/app/api/client/_current-user";
import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";
import { getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

async function ensureStripeCustomer(
  db: ReturnType<typeof getDb>,
  stripe: Stripe,
  userId: string,
): Promise<{ customerId: string; email: string | null }> {
  const [user] = (await db`
    SELECT id, email, first_name, last_name, business_name, stripe_customer_id
    FROM stylehub_users
    WHERE id = ${userId}
    LIMIT 1
  `) as Array<{
    id: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    business_name: string | null;
    stripe_customer_id: string | null;
  }>;

  if (!user) {
    throw new Error("No se encontró el usuario para crear customer en Stripe.");
  }

  if (user.stripe_customer_id) {
    try {
      const existingCustomer = await stripe.customers.retrieve(user.stripe_customer_id);
      if (!("deleted" in existingCustomer && existingCustomer.deleted)) {
        return { customerId: user.stripe_customer_id, email: user.email };
      }
    } catch (error) {
      const stripeError = error as { type?: string; param?: string; code?: string };
      const isRecoverableCustomerError =
        stripeError.type === "StripeInvalidRequestError" ||
        stripeError.param === "customer" ||
        stripeError.code === "resource_missing";

      if (!isRecoverableCustomerError) {
        throw error;
      }
    }
  }

  const fullName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  const customer = await stripe.customers.create({
    email: user.email || undefined,
    name: user.business_name || fullName || undefined,
    metadata: { stylehubUserId: user.id },
  });

  await db`
    UPDATE stylehub_users
    SET stripe_customer_id = ${customer.id},
        updated_at = NOW()
    WHERE id = ${user.id}
  `;

  return { customerId: customer.id, email: user.email };
}

export async function POST(request: Request) {
  const auth = await getCurrentClientUser();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    await ensureStylehubSchema();
    const db = getDb();

    const payload = (await request.json()) as {
      amount?: number;
      paymentMethodId?: string;
      notes?: string;
    };

    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount < 10) {
      return NextResponse.json({ error: "El monto mínimo de recarga es de $10 MXN." }, { status: 400 });
    }

    if (amount > 10000) {
      return NextResponse.json({ error: "El monto máximo por recarga es de $10,000." }, { status: 400 });
    }

    const paymentsMode = (process.env.PAYMENTS_MODE || "").trim().toLowerCase();
    const isMockMode = paymentsMode === "mock";

    if (!isMockMode && !process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        {
          error:
            "Pagos con Stripe no configurados. Agrega STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET en .env.local, o usa PAYMENTS_MODE=mock para pruebas.",
        },
        { status: 400 },
      );
    }

    const [wallet] = (await db`
      INSERT INTO stylehub_client_wallets (user_id)
      VALUES (${auth.userId})
      ON CONFLICT (user_id) DO UPDATE SET updated_at = stylehub_client_wallets.updated_at
      RETURNING id, balance, currency
    `) as Array<{ id: string; balance: string; currency: string }>;

    const selectedMethod = payload.paymentMethodId
      ? ((await db`
        SELECT id, provider, token_reference
        FROM stylehub_client_payment_methods
        WHERE id = ${payload.paymentMethodId}
          AND user_id = ${auth.userId}
        LIMIT 1
      `) as Array<{ id: string; provider: string; token_reference: string | null }>)[0]
      : null;

    if (payload.paymentMethodId && !selectedMethod) {
      return NextResponse.json({ error: "El método de pago no es válido para este usuario." }, { status: 400 });
    }

    if (isMockMode) {
      const [updatedWallet] = (await db`
        UPDATE stylehub_client_wallets
        SET balance = balance + ${amount},
            updated_at = NOW()
        WHERE id = ${wallet.id}
        RETURNING id, balance, currency
      `) as Array<{ id: string; balance: string; currency: string }>;

      await db`
        INSERT INTO stylehub_client_wallet_transactions (
          wallet_id,
          user_id,
          transaction_type,
          amount,
          payment_method_id,
          payment_provider,
          status,
          notes
        )
        VALUES (
          ${wallet.id},
          ${auth.userId},
          'recharge',
          ${amount},
          ${payload.paymentMethodId?.trim() || null},
          'mock',
          'completed',
          ${payload.notes?.trim() || "Recarga simulada (modo mock)"}
        )
      `;

      return NextResponse.json({ wallet: updatedWallet, mode: "mock" }, { status: 201 });
    }

    const stripe = getStripeClient();
    const { customerId, email } = await ensureStripeCustomer(db, stripe, auth.userId);

    if (selectedMethod?.provider === "card" && selectedMethod.token_reference) {
      try {
        const intent = await stripe.paymentIntents.create({
          amount: Math.round(amount * 100),
          currency: "mxn",
          customer: customerId,
          payment_method: selectedMethod.token_reference,
          off_session: true,
          confirm: true,
          metadata: {
            userId: auth.userId,
            walletId: wallet.id,
          },
        });

        if (intent.status === "succeeded") {
          const [updatedWallet] = (await db`
            UPDATE stylehub_client_wallets
            SET balance = balance + ${amount},
                updated_at = NOW()
            WHERE id = ${wallet.id}
            RETURNING id, balance, currency
          `) as Array<{ id: string; balance: string; currency: string }>;

          await db`
            INSERT INTO stylehub_client_wallet_transactions (
              wallet_id,
              user_id,
              transaction_type,
              amount,
              payment_method_id,
              payment_provider,
              status,
              external_reference,
              notes
            )
            VALUES (
              ${wallet.id},
              ${auth.userId},
              'recharge',
              ${amount},
              ${selectedMethod.id},
              'stripe',
              'completed',
              ${intent.id},
              ${payload.notes?.trim() || "Recarga con tarjeta guardada"}
            )
          `;

          return NextResponse.json({ wallet: updatedWallet, mode: "stripe-direct" }, { status: 201 });
        }

        // Si el intento no fue exitoso (requiere autenticación, etc), abre Checkout como fallback
        console.log(`Direct charge intent status: ${intent.status}, falling back to checkout`);
      } catch (error) {
        // Si el cobro directo falla, cae a checkout automáticamente
        console.log(`Direct charge failed, falling back to checkout:`, error);
      }
    }

    const [pendingTx] = (await db`
      INSERT INTO stylehub_client_wallet_transactions (
        wallet_id,
        user_id,
        transaction_type,
        amount,
        payment_method_id,
        payment_provider,
        status,
        notes
      )
      VALUES (
        ${wallet.id},
        ${auth.userId},
        'recharge',
        ${amount},
        ${payload.paymentMethodId?.trim() || null},
        'stripe',
        'pending',
        ${payload.notes?.trim() || "Recarga iniciada desde panel cliente"}
      )
      RETURNING id
    `) as Array<{ id: string }>;

    const requestUrl = new URL(request.url);
    const origin = `${requestUrl.protocol}//${requestUrl.host}`;
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${origin}/dashboard/cliente/pagos?recharge=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard/cliente/pagos?recharge=cancelled`,
      locale: "en",
      customer: customerId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "mxn",
            unit_amount: Math.round(amount * 100),
            product_data: {
              name: "Recarga de saldo StyleHub",
            },
          },
        },
      ],
      metadata: {
        userId: auth.userId,
        walletId: wallet.id,
        walletTransactionId: pendingTx.id,
      },
      payment_intent_data: {
        setup_future_usage: "off_session",
      },
    });

    await db`
      UPDATE stylehub_client_wallet_transactions
      SET external_reference = ${checkoutSession.id}
      WHERE id = ${pendingTx.id}
    `;

    return NextResponse.json({ checkoutUrl: checkoutSession.url, mode: "stripe" }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo procesar la recarga." }, { status: 500 });
  }
}
