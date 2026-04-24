import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";

export async function getCurrentClientUser() {
  const session = await getServerSession(authConfig);

  if (!session?.user?.id && !session?.user?.email) {
    return { error: NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 }) };
  }

  if (session.user.accountType === "cliente" && session.user.id) {
    return { userId: session.user.id };
  }

  await ensureStylehubSchema();
  const db = getDb();

  const email = session.user.email?.trim().toLowerCase();
  if (email) {
    const byEmail = (await db`
      SELECT id
      FROM stylehub_users
      WHERE email = ${email}
      AND account_type = 'cliente'
      LIMIT 1
    `) as Array<{ id: string }>;

    if (byEmail[0]?.id) {
      return { userId: byEmail[0].id };
    }
  }

  if (session.user.id) {
    const byId = (await db`
      SELECT id
      FROM stylehub_users
      WHERE id = ${session.user.id}
      AND account_type = 'cliente'
      LIMIT 1
    `) as Array<{ id: string }>;

    if (byId[0]?.id) {
      return { userId: byId[0].id };
    }
  }

  return { error: NextResponse.json({ error: "Solo clientes pueden usar este recurso." }, { status: 403 }) };
}
