import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";

export type AdminUser = { id: string; email: string };

/**
 * Verifica en el servidor que quien llama sea un administrador.
 *
 * Toda ruta de `app/api/admin/` debe llamarla al inicio de cada handler:
 *
 *   const admin = await requireAdmin();
 *   if ("error" in admin) return admin.error;
 *
 * No basta con el JWT de la sesión: se confirma en la base que la cuenta siga siendo
 * administradora y no esté suspendida (si se le quita el rol, pierde el acceso de inmediato).
 * La prueba `tests/admin-auth.test.ts` falla si alguna ruta de administración no la usa.
 */
export async function requireAdmin(): Promise<{ admin: AdminUser } | { error: NextResponse }> {
  const session = await getServerSession(authConfig);

  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 }) };
  }

  if (session.user.accountType !== "admin") {
    return { error: NextResponse.json({ error: "Solo administradores pueden usar este recurso." }, { status: 403 }) };
  }

  await ensureStylehubSchema();
  const db = getDb();

  const [admin] = (await db`
    SELECT id, email
    FROM stylehub_users
    WHERE id = ${session.user.id}
      AND account_type = 'admin'
      AND is_banned = FALSE
    LIMIT 1
  `) as Array<AdminUser>;

  if (!admin) {
    return { error: NextResponse.json({ error: "Solo administradores pueden usar este recurso." }, { status: 403 }) };
  }

  return { admin };
}
