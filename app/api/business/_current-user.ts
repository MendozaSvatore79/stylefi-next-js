import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";

export async function getCurrentBusinessUser() {
  const session = await getServerSession(authConfig);

  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 }) };
  }

  if (session.user.accountType === "negocio") {
    return { userId: session.user.id };
  }

  const db = getDb();
  await ensureStylehubSchema();

  const result = (await db`
    SELECT account_type
    FROM stylehub_users
    WHERE id = ${session.user.id}
    LIMIT 1
  `) as Array<{ account_type: string }>;

  if (result[0]?.account_type === "negocio") {
    return { userId: session.user.id };
  }

  return { error: NextResponse.json({ error: "Solo negocios pueden usar este recurso." }, { status: 403 }) };
}
