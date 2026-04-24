import { NextResponse } from "next/server";

import { getCurrentClientUser } from "@/app/api/client/_current-user";
import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";
import { getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

type PaymentProvider = "card" | "transfer" | "cash" | "wallet" | "paypal";

function isPaymentProvider(value: unknown): value is PaymentProvider {
  return value === "card" || value === "transfer" || value === "cash" || value === "wallet" || value === "paypal";
}

export async function GET() {
  const auth = await getCurrentClientUser();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    await ensureStylehubSchema();
    const db = getDb();

    const methods = await db`
      SELECT
        id,
        provider,
        card_brand,
        card_last4,
        holder_name,
        paypal_email,
        is_default,
        created_at
      FROM stylehub_client_payment_methods
      WHERE user_id = ${auth.userId}
      ORDER BY is_default DESC, created_at DESC
    `;

    const [wallet] = (await db`
      INSERT INTO stylehub_client_wallets (user_id)
      VALUES (${auth.userId})
      ON CONFLICT (user_id) DO UPDATE SET updated_at = stylehub_client_wallets.updated_at
      RETURNING id, balance, currency
    `) as Array<{ id: string; balance: string; currency: string }>;

    const transactions = await db`
      SELECT id, transaction_type, amount, payment_provider, status, notes, created_at
      FROM stylehub_client_wallet_transactions
      WHERE user_id = ${auth.userId}
      ORDER BY created_at DESC
      LIMIT 8
    `;

    return NextResponse.json({ methods, wallet, transactions });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudieron cargar los métodos de pago." }, { status: 500 });
  }
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
      paymentMethodId?: string;
      provider?: PaymentProvider;
      holderName?: string;
      paypalEmail?: string;
      isDefault?: boolean;
    };

    if (payload.paymentMethodId?.trim()) {
      const paymentMethodId = payload.paymentMethodId.trim();
      const stripe = getStripeClient();

      const [user] = (await db`
        SELECT id, email, first_name, last_name, business_name, stripe_customer_id
        FROM stylehub_users
        WHERE id = ${auth.userId}
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
        return NextResponse.json({ error: "No se encontró el usuario para guardar la tarjeta." }, { status: 404 });
      }

      let customerId = user.stripe_customer_id;
      const fullName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();

      if (customerId) {
        try {
          const existingCustomer = await stripe.customers.retrieve(customerId);
          if ("deleted" in existingCustomer && existingCustomer.deleted) {
            customerId = null;
          }
        } catch {
          customerId = null;
        }
      }

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email ?? undefined,
          name: user.business_name || fullName || undefined,
          metadata: { stylehubUserId: user.id },
        });
        customerId = customer.id;
        await db`
          UPDATE stylehub_users
          SET stripe_customer_id = ${customerId},
              updated_at = NOW()
          WHERE id = ${auth.userId}
        `;
      }

      const pm = await stripe.paymentMethods.retrieve(paymentMethodId);

      if (pm.type !== "card" || !pm.card) {
        return NextResponse.json({ error: "El método de pago no es una tarjeta válida." }, { status: 400 });
      }

      if (pm.customer && pm.customer !== customerId) {
        return NextResponse.json(
          { error: "Esta tarjeta ya está asociada a otra cuenta de Stripe." },
          { status: 400 },
        );
      }

      if (!pm.customer) {
        await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
      }

      const [existingToken] = (await db`
        SELECT id, user_id, provider, card_brand, card_last4, holder_name, paypal_email, is_default, created_at
        FROM stylehub_client_payment_methods
        WHERE token_reference = ${pm.id}
        LIMIT 1
      `) as Array<{
        id: string;
        user_id: string;
        provider: string;
        card_brand: string | null;
        card_last4: string | null;
        holder_name: string | null;
        paypal_email: string | null;
        is_default: boolean;
        created_at: string;
      }>;

      if (existingToken && existingToken.user_id !== auth.userId) {
        return NextResponse.json({ error: "Esta tarjeta ya está registrada en otra cuenta." }, { status: 400 });
      }

      const requestedDefault = Boolean(payload.isDefault);
      const existing = (await db`
        SELECT COUNT(*)::int as count FROM stylehub_client_payment_methods WHERE user_id = ${auth.userId} AND provider = 'card'
      `) as Array<{ count: number }>;
      const isFirstCard = existing.length === 0 || existing[0].count === 0;
      const isDefault = requestedDefault || isFirstCard;

      if (isDefault) {
        await db`
          UPDATE stylehub_client_payment_methods
          SET is_default = FALSE,
              updated_at = NOW()
          WHERE user_id = ${auth.userId}
            AND provider = 'card'
        `;
      }

      if (existingToken && existingToken.user_id === auth.userId) {
        const [updatedMethod] = (await db`
          UPDATE stylehub_client_payment_methods
          SET card_brand = ${pm.card.brand},
              card_last4 = ${pm.card.last4},
              holder_name = ${pm.billing_details.name || null},
              is_default = ${isDefault},
              updated_at = NOW()
          WHERE id = ${existingToken.id}
          RETURNING id, provider, card_brand, card_last4, holder_name, paypal_email, is_default, created_at
        `) as Array<{
          id: string;
          provider: string;
          card_brand: string | null;
          card_last4: string | null;
          holder_name: string | null;
          paypal_email: string | null;
          is_default: boolean;
          created_at: string;
        }>;

        return NextResponse.json({ method: updatedMethod }, { status: 200 });
      }

      const [method] = (await db`
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
          ${pm.card.brand},
          ${pm.card.last4},
          ${pm.billing_details.name || null},
          ${pm.id},
          ${isDefault},
          NOW()
        )
        RETURNING id, provider, card_brand, card_last4, holder_name, token_reference, is_default, created_at
      `) as Array<{
        id: string;
        provider: string;
        card_brand: string | null;
        card_last4: string | null;
        holder_name: string | null;
        token_reference: string | null;
        is_default: boolean;
        created_at: string;
      }>;
      return NextResponse.json({ method }, { status: 201 });
    }

    if (!isPaymentProvider(payload.provider)) {
      return NextResponse.json({ error: "Selecciona un tipo de método de pago válido." }, { status: 400 });
    }

    if (payload.provider === "card") {
      return NextResponse.json(
        { error: "Para guardar tarjeta usa el formulario seguro de Stripe (número, vencimiento y CVC)." },
        { status: 400 },
      );
    }

    const holderName = payload.holderName?.trim() || null;
    const paypalEmail = payload.provider === "paypal" ? payload.paypalEmail?.trim()?.toLowerCase() || null : null;
    const isDefault = Boolean(payload.isDefault);

    if (payload.provider === "paypal" && (!paypalEmail || !/^\S+@\S+\.\S+$/.test(paypalEmail))) {
      return NextResponse.json({ error: "Ingresa un correo de PayPal válido." }, { status: 400 });
    }

    if (isDefault) {
      await db`
        UPDATE stylehub_client_payment_methods
        SET is_default = FALSE,
            updated_at = NOW()
        WHERE user_id = ${auth.userId}
      `;
    }

    const [method] = (await db`
      INSERT INTO stylehub_client_payment_methods (
        user_id,
        provider,
        card_brand,
        card_last4,
        holder_name,
        paypal_email,
        is_default,
        updated_at
      )
      VALUES (
        ${auth.userId},
        ${payload.provider},
        ${null},
        ${null},
        ${holderName},
        ${paypalEmail},
        ${isDefault},
        NOW()
      )
      RETURNING id, provider, card_brand, card_last4, holder_name, paypal_email, is_default, created_at
    `) as Array<{
      id: string;
      provider: string;
      card_brand: string | null;
      card_last4: string | null;
      holder_name: string | null;
      paypal_email: string | null;
      is_default: boolean;
      created_at: string;
    }>;

    return NextResponse.json({ method }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo guardar el método de pago." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await getCurrentClientUser();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    await ensureStylehubSchema();
    const db = getDb();
    const payload = (await request.json()) as {
      methodId?: string;
      holderName?: string;
      paypalEmail?: string;
      isDefault?: boolean;
    };

    const methodId = payload.methodId?.trim();
    if (!methodId) {
      return NextResponse.json({ error: "Debes indicar el método a editar." }, { status: 400 });
    }

    const [existing] = (await db`
      SELECT id, provider
      FROM stylehub_client_payment_methods
      WHERE id = ${methodId}
        AND user_id = ${auth.userId}
      LIMIT 1
    `) as Array<{ id: string; provider: PaymentProvider }>;

    if (!existing) {
      return NextResponse.json({ error: "Método de pago no encontrado." }, { status: 404 });
    }

    const holderName = payload.holderName?.trim() || null;
    const paypalEmail =
      existing.provider === "paypal" ? (payload.paypalEmail?.trim()?.toLowerCase() || null) : null;
    const isDefault = Boolean(payload.isDefault);

    if (existing.provider === "paypal" && (!paypalEmail || !/^\S+@\S+\.\S+$/.test(paypalEmail))) {
      return NextResponse.json({ error: "Ingresa un correo de PayPal válido." }, { status: 400 });
    }

    if (isDefault) {
      await db`
        UPDATE stylehub_client_payment_methods
        SET is_default = FALSE,
            updated_at = NOW()
        WHERE user_id = ${auth.userId}
      `;
    }

    const [updated] = (await db`
      UPDATE stylehub_client_payment_methods
      SET holder_name = ${holderName},
          paypal_email = CASE WHEN provider = 'paypal' THEN ${paypalEmail} ELSE paypal_email END,
          is_default = ${isDefault},
          updated_at = NOW()
      WHERE id = ${methodId}
        AND user_id = ${auth.userId}
      RETURNING id, provider, card_brand, card_last4, holder_name, paypal_email, is_default, created_at
    `) as Array<{
      id: string;
      provider: string;
      card_brand: string | null;
      card_last4: string | null;
      holder_name: string | null;
      paypal_email: string | null;
      is_default: boolean;
      created_at: string;
    }>;

    return NextResponse.json({ method: updated }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo editar el método de pago." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await getCurrentClientUser();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    await ensureStylehubSchema();
    const db = getDb();
    const payload = (await request.json()) as { methodId?: string };
    const methodId = payload.methodId?.trim();

    if (!methodId) {
      return NextResponse.json({ error: "Debes indicar el método a eliminar." }, { status: 400 });
    }

    const [existing] = (await db`
      SELECT id, provider, token_reference, is_default
      FROM stylehub_client_payment_methods
      WHERE id = ${methodId}
        AND user_id = ${auth.userId}
      LIMIT 1
    `) as Array<{
      id: string;
      provider: PaymentProvider;
      token_reference: string | null;
      is_default: boolean;
    }>;

    if (!existing) {
      return NextResponse.json({ error: "Método de pago no encontrado." }, { status: 404 });
    }

    if (existing.provider === "card" && existing.token_reference) {
      try {
        const stripe = getStripeClient();
        await stripe.paymentMethods.detach(existing.token_reference);
      } catch (error) {
        console.warn("No se pudo desligar payment method de Stripe", error);
      }
    }

    await db`
      DELETE FROM stylehub_client_payment_methods
      WHERE id = ${methodId}
        AND user_id = ${auth.userId}
    `;

    if (existing.is_default) {
      await db`
        WITH candidate AS (
          SELECT id
          FROM stylehub_client_payment_methods
          WHERE user_id = ${auth.userId}
          ORDER BY created_at DESC
          LIMIT 1
        )
        UPDATE stylehub_client_payment_methods
        SET is_default = TRUE,
            updated_at = NOW()
        WHERE id IN (SELECT id FROM candidate)
      `;
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo eliminar el método de pago." }, { status: 500 });
  }
}
