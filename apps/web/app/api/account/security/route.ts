import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";
import { sendAccountDeletionTokenEmail } from "@/lib/email";
import { createOtpSalt, generateOtpCode, hashOtpCode } from "@/lib/otp";
import { obtenerSesion } from "@/lib/sesion";

export const runtime = "nodejs";

/**
 * Seguridad de la cuenta. La contraseña, el correo y los métodos de acceso los administra Clerk (su perfil de
 * usuario); aquí queda eliminar la cuenta, con las mismas reglas de antes: escribir el correo y un token de 6
 * dígitos enviado por correo (vence en 10 minutos, 5 intentos). Al eliminar se borra la cuenta en nuestra base
 * y en Clerk.
 */

type FilaSeguridad = {
  id: string;
  email: string;
  account_type: string;
  first_name: string | null;
  business_name: string | null;
  clerk_user_id: string | null;
};

async function usuarioActual() {
  const sesion = await obtenerSesion();
  if (!sesion) {
    return { error: NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 }) } as const;
  }
  await ensureStylehubSchema();
  const db = getDb();
  const [user] = (await db`
    SELECT id, email, account_type, first_name, business_name, clerk_user_id
    FROM stylehub_users
    WHERE id = ${sesion.user.id}
    LIMIT 1
  `) as FilaSeguridad[];
  if (!user) {
    return { error: NextResponse.json({ error: "No se encontró la cuenta." }, { status: 404 }) } as const;
  }
  return { db, user, sesion } as const;
}

export async function GET() {
  const actual = await usuarioActual();
  if (actual.error) return actual.error;
  return NextResponse.json({
    email: actual.user.email,
    accountType: actual.user.account_type,
    hasGoogle: actual.sesion.user.authProvider === "google",
  });
}

/** Envía el token para eliminar la cuenta (hay que escribir el correo para pedirlo). */
export async function POST(request: Request) {
  const actual = await usuarioActual();
  if (actual.error) return actual.error;
  const { db, user } = actual;

  try {
    const payload = (await request.json().catch(() => ({}))) as { confirmation?: string };
    const confirmation = (payload.confirmation ?? "").trim().toLowerCase();
    if (!confirmation || confirmation !== user.email.toLowerCase()) {
      return NextResponse.json(
        { error: "Para enviar el token, confirma escribiendo tu correo exactamente." },
        { status: 400 },
      );
    }

    const token = generateOtpCode();
    const tokenSalt = createOtpSalt();
    const tokenHash = hashOtpCode(token, tokenSalt);
    const expiresAt = new Date(Date.now() + 10 * 60_000);

    await db`
      DELETE FROM stylehub_account_deletion_tokens
      WHERE user_id = ${user.id}
        AND (used_at IS NOT NULL OR expires_at < NOW())
    `;
    await db`
      INSERT INTO stylehub_account_deletion_tokens (user_id, token_hash, token_salt, attempts, expires_at)
      VALUES (${user.id}, ${tokenHash}, ${tokenSalt}, 0, ${expiresAt})
    `;
    await sendAccountDeletionTokenEmail({
      to: user.email,
      token,
      recipientName: user.first_name ?? user.business_name ?? undefined,
    });

    return NextResponse.json({
      ok: true,
      message: "Enviamos un token de confirmación a tu correo. Vence en 10 minutos.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo enviar el token." }, { status: 500 });
  }
}

/** Elimina la cuenta: correo escrito + token válido. Borra la cuenta en nuestra base y en Clerk. */
export async function DELETE(request: Request) {
  const actual = await usuarioActual();
  if (actual.error) return actual.error;
  const { db, user } = actual;

  try {
    const payload = (await request.json().catch(() => ({}))) as { confirmation?: string; token?: string };
    const confirmation = (payload.confirmation ?? "").trim();
    const token = (payload.token ?? "").trim();

    if (confirmation.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json(
        { error: "Para eliminar la cuenta debes confirmar escribiendo tu correo exactamente." },
        { status: 400 },
      );
    }
    if (!/^\d{6}$/.test(token)) {
      return NextResponse.json({ error: "Ingresa el token de 6 dígitos enviado a tu correo." }, { status: 400 });
    }

    const [activo] = (await db`
      SELECT id, token_hash, token_salt, attempts, expires_at
      FROM stylehub_account_deletion_tokens
      WHERE user_id = ${user.id}
        AND used_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `) as Array<{ id: string; token_hash: string; token_salt: string; attempts: number; expires_at: string }>;

    if (!activo) {
      return NextResponse.json({ error: "Primero solicita un token de eliminación por correo." }, { status: 404 });
    }
    if (new Date(activo.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "El token expiró. Solicita uno nuevo." }, { status: 410 });
    }
    if (activo.attempts >= 5) {
      return NextResponse.json({ error: "Demasiados intentos. Solicita un nuevo token." }, { status: 429 });
    }
    if (hashOtpCode(token, activo.token_salt) !== activo.token_hash) {
      await db`UPDATE stylehub_account_deletion_tokens SET attempts = attempts + 1 WHERE id = ${activo.id}`;
      return NextResponse.json({ error: "El token no coincide." }, { status: 400 });
    }

    await db`UPDATE stylehub_account_deletion_tokens SET used_at = NOW() WHERE id = ${activo.id}`;
    await db`DELETE FROM stylehub_users WHERE id = ${user.id}`;

    // La cuenta de nuestra base ya no existe; se borra también en Clerk. Si Clerk falla, la persona podría volver
    // a entrar, pero llegaría a "completar registro" sin ninguno de sus datos anteriores.
    if (user.clerk_user_id) {
      try {
        const clerk = await clerkClient();
        await clerk.users.deleteUser(user.clerk_user_id);
      } catch (error) {
        console.error("No se pudo borrar la cuenta en Clerk", error);
      }
    }

    return NextResponse.json({ ok: true, message: "Tu cuenta fue eliminada correctamente." });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo eliminar la cuenta." }, { status: 500 });
  }
}
