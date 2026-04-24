import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authConfig } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authConfig);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Debes iniciar sesión con Google." }, { status: 401 });
  }

  try {
    await ensureStylehubSchema();
    const db = getDb();
    const email = session.user.email.trim().toLowerCase();

    const [user] = (await db`
      SELECT id, account_type, first_name, last_name, business_name, phone, email
      FROM stylehub_users
      WHERE email = ${email}
      LIMIT 1
    `) as Array<{
      id: string;
      account_type: "cliente" | "negocio";
      first_name: string | null;
      last_name: string | null;
      business_name: string | null;
      phone: string | null;
      email: string;
    }>;

    if (user) {
      return NextResponse.json({ exists: true, user });
    }

    return NextResponse.json({
      exists: false,
      profile: {
        email,
        name: session.user.name ?? "",
        image: session.user.image ?? null,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo cargar el estado de Google." }, { status: 500 });
  }
}