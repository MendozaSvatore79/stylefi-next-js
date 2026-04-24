import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authConfig } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";

export const runtime = "nodejs";

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

export async function POST(request: Request) {
  const session = await getServerSession(authConfig);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Debes iniciar sesión con Google." }, { status: 401 });
  }

  try {
    await ensureStylehubSchema();
    const db = getDb();
    const payload = (await request.json()) as {
      accountType?: "cliente" | "negocio";
      firstName?: string;
      lastName?: string;
      businessName?: string;
      rfc?: string;
      phone?: string;
    };

    const email = session.user.email.trim().toLowerCase();
    const accountType = payload.accountType === "negocio" ? "negocio" : "cliente";
    const currentName = session.user.name ?? "";
    const inferred = splitName(currentName);
    const firstName = payload.firstName?.trim() || inferred.firstName || null;
    const lastName = payload.lastName?.trim() || inferred.lastName || null;
    const businessName = payload.businessName?.trim() || null;
    const rfc = payload.rfc?.trim() || null;
    const phone = payload.phone?.trim() || null;

    if (accountType === "negocio" && (!firstName || !lastName || !businessName || !rfc || !phone)) {
      return NextResponse.json({ error: "Completa nombre, negocio, RFC y teléfono." }, { status: 400 });
    }

    if (accountType === "cliente" && !phone) {
      return NextResponse.json({ error: "Completa tu teléfono para continuar." }, { status: 400 });
    }

    const [user] = (await db`
      INSERT INTO stylehub_users (
        account_type,
        first_name,
        last_name,
        business_name,
        rfc,
        phone,
        email,
        password_hash,
        email_verified,
        verified_at,
        updated_at
      )
      VALUES (
        ${accountType},
        ${firstName},
        ${lastName},
        ${businessName},
        ${rfc},
        ${phone},
        ${email},
        ${null},
        TRUE,
        NOW(),
        NOW()
      )
      ON CONFLICT (email) DO UPDATE SET
        account_type = EXCLUDED.account_type,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        business_name = EXCLUDED.business_name,
        rfc = EXCLUDED.rfc,
        phone = COALESCE(EXCLUDED.phone, stylehub_users.phone),
        email_verified = TRUE,
        verified_at = COALESCE(stylehub_users.verified_at, NOW()),
        updated_at = NOW()
      RETURNING id, account_type
    `) as Array<{ id: string; account_type: "cliente" | "negocio" }>;

    return NextResponse.json({
      ok: true,
      redirectTo: user?.account_type === "negocio" ? "/dashboard/negocio" : "/dashboard/cliente",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo completar el alta con Google." }, { status: 500 });
  }
}