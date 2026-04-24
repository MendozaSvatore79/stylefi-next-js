import { NextResponse } from "next/server";

import { getCurrentClientUser } from "@/app/api/client/_current-user";
import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";

export const runtime = "nodejs";

export async function GET() {
  const auth = await getCurrentClientUser();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    await ensureStylehubSchema();
    const db = getDb();

    const result = (await db`
      SELECT onboarding_seen
      FROM stylehub_users
      WHERE id = ${auth.userId}
      LIMIT 1
    `) as Array<{ onboarding_seen: boolean }>;

    return NextResponse.json({ seen: result[0]?.onboarding_seen ?? false });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo cargar onboarding." }, { status: 500 });
  }
}

export async function POST() {
  const auth = await getCurrentClientUser();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    await ensureStylehubSchema();
    const db = getDb();

    await db`
      UPDATE stylehub_users
      SET onboarding_seen = TRUE,
          updated_at = NOW()
      WHERE id = ${auth.userId}
    `;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo actualizar onboarding." }, { status: 500 });
  }
}
