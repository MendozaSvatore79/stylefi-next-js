import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";
import { getCurrentClientUser } from "@/app/api/client/_current-user";
import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";

export const runtime = "nodejs";

export async function POST() {
  const auth = await getCurrentClientUser();
  if ("error" in auth) return auth.error;

  await ensureStylehubSchema();
  const db = getDb();
  const stripe = getStripeClient();

  // Busca o crea el customer de Stripe
  const users = await db`SELECT stripe_customer_id, email FROM stylehub_users WHERE id = ${auth.userId}` as Array<{ stripe_customer_id: string | null, email: string | null }>;
  const user = users[0];
  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  }

  let customerId = user.stripe_customer_id;
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
    const customer = await stripe.customers.create({ email: user.email ?? undefined });
    await db`UPDATE stylehub_users SET stripe_customer_id = ${customer.id} WHERE id = ${auth.userId}`;
    customerId = customer.id;
  }

  // Crea el SetupIntent
  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    usage: "off_session",
  });

  return NextResponse.json({ clientSecret: setupIntent.client_secret });
}
