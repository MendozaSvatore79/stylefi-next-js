import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";
import { estadoDeRegistro, inicioPorTipo } from "@/lib/sesion";

export const runtime = "nodejs";

type Datos = {
  accountType?: string;
  firstName?: string;
  lastName?: string;
  businessName?: string;
  rfc?: string;
  phone?: string;
};

const limpio = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Crea la cuenta de StyleFi de quien ya entró con Clerk y aún no tiene una: elige cliente o negocio, con los
 * mismos datos obligatorios que el registro anterior. El correo sale de Clerk y solo si Clerk lo verificó.
 * Nunca modifica una cuenta existente (las que ya existían se vinculan solas por correo verificado al entrar).
 */
export async function POST(request: Request) {
  const estado = await estadoDeRegistro();
  if (estado.estado === "sin-sesion") {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }
  if (estado.estado === "baneada") {
    return NextResponse.json({ error: "Tu cuenta está suspendida." }, { status: 403 });
  }
  if (estado.estado === "lista") {
    return NextResponse.json({ ok: true, redirectTo: inicioPorTipo(estado.accountType) });
  }
  const { clerk } = estado;
  if (!clerk.correoVerificado) {
    return NextResponse.json({ error: "Verifica tu correo en el inicio de sesión antes de continuar." }, { status: 400 });
  }

  const datos = (await request.json().catch(() => ({}))) as Datos;
  const accountType = datos.accountType === "negocio" ? "negocio" : datos.accountType === "cliente" ? "cliente" : null;
  const firstName = limpio(datos.firstName) || null;
  const lastName = limpio(datos.lastName) || null;
  const businessName = limpio(datos.businessName) || null;
  const rfc = limpio(datos.rfc, 13).toUpperCase() || null;
  const phone = limpio(datos.phone, 20) || null;

  if (!accountType) {
    return NextResponse.json({ error: "Elige si eres cliente o negocio." }, { status: 400 });
  }
  if (accountType === "negocio" && (!firstName || !lastName || !businessName || !rfc || !phone)) {
    return NextResponse.json({ error: "Completa nombre, apellidos, negocio, RFC y teléfono." }, { status: 400 });
  }
  if (accountType === "cliente" && !phone) {
    return NextResponse.json({ error: "Completa tu teléfono para continuar." }, { status: 400 });
  }

  await ensureStylehubSchema();
  const db = getDb();
  const [creada] = (await db`
    INSERT INTO stylehub_users (
      account_type, first_name, last_name, business_name, rfc, phone, email,
      email_verified, verified_at, clerk_user_id, updated_at
    )
    VALUES (
      ${accountType}, ${firstName}, ${lastName}, ${businessName}, ${rfc}, ${phone}, ${clerk.correoVerificado},
      TRUE, NOW(), ${clerk.clerkUserId}, NOW()
    )
    ON CONFLICT DO NOTHING
    RETURNING id, account_type
  `) as Array<{ id: string; account_type: "cliente" | "negocio" }>;

  if (!creada) {
    return NextResponse.json(
      { error: "Ese correo ya está registrado con otra cuenta. Entra con esa cuenta o escríbenos a soporte." },
      { status: 409 },
    );
  }
  if (accountType === "cliente") {
    await db`INSERT INTO stylehub_client_wallets (user_id) VALUES (${creada.id}) ON CONFLICT (user_id) DO NOTHING`;
  }
  return NextResponse.json({ ok: true, redirectTo: inicioPorTipo(creada.account_type) });
}
