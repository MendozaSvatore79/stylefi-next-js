import { NextResponse } from "next/server";

import { getCurrentClientUser } from "@/app/api/client/_current-user";
import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";

export const runtime = "nodejs";

export async function DELETE() {
  const auth = await getCurrentClientUser();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    await ensureStylehubSchema();
    const db = getDb();

    const deleted = (await db`
      DELETE FROM stylehub_client_wallet_transactions
      WHERE user_id = ${auth.userId}
        AND transaction_type = 'recharge'
      RETURNING id
    `) as Array<{ id: string }>;

    return NextResponse.json({ deletedCount: deleted.length }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudieron limpiar los registros de recargas." }, { status: 500 });
  }
}
