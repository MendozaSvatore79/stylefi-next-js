import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authConfig } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";

export const runtime = "nodejs";

async function resolveUserId() {
  const session = await getServerSession(authConfig);

  if (!session?.user) {
    return { error: NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 }) };
  }

  await ensureStylehubSchema();
  const db = getDb();

  if (session.user.id) {
    const [byId] = (await db`
      SELECT id
      FROM stylehub_users
      WHERE id = ${session.user.id}
      LIMIT 1
    `) as Array<{ id: string }>;

    if (byId?.id) {
      return { userId: byId.id };
    }
  }

  const email = session.user.email?.trim().toLowerCase();
  if (!email) {
    return { error: NextResponse.json({ error: "No se encontró el correo del usuario." }, { status: 400 }) };
  }

  const [byEmail] = (await db`
    SELECT id
    FROM stylehub_users
    WHERE email = ${email}
    LIMIT 1
  `) as Array<{ id: string }>;

  if (!byEmail?.id) {
    return { error: NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 }) };
  }

  return { userId: byEmail.id };
}

export async function GET() {
  const resolved = await resolveUserId();
  if ("error" in resolved) {
    return resolved.error;
  }

  try {
    const db = getDb();

    const [row] = (await db`
      SELECT onboarding_seen
      FROM stylehub_users
      WHERE id = ${resolved.userId}
      LIMIT 1
    `) as Array<{ onboarding_seen: boolean }>;

    return NextResponse.json({ seen: row?.onboarding_seen ?? false });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo cargar onboarding." }, { status: 500 });
  }
}

export async function POST() {
  const resolved = await resolveUserId();
  if ("error" in resolved) {
    return resolved.error;
  }

  try {
    const db = getDb();

    await db`
      UPDATE stylehub_users
      SET onboarding_seen = TRUE,
          updated_at = NOW()
      WHERE id = ${resolved.userId}
    `;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo actualizar onboarding." }, { status: 500 });
  }
}
