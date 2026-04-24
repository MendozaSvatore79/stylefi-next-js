import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";
import { sendPasswordResetEmail } from "@/lib/email";
import { createResetSalt, generateResetOtp, generateResetToken, hashResetSecret } from "@/lib/password-reset";

export const runtime = "nodejs";

type PasswordResetRequestPayload = {
  email?: string;
};

function toText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PasswordResetRequestPayload;
    const email = toText(body.email).toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Ingresa un correo válido." }, { status: 400 });
    }

    const db = getDb();
    await ensureStylehubSchema();

    const users = (await db`
      SELECT id, first_name, email
      FROM stylehub_users
      WHERE email = ${email}
      LIMIT 1
    `) as Array<{ id: string; first_name: string | null; email: string }>;

    if (users.length === 0) {
      return NextResponse.json({ success: true, message: "Si el correo existe, recibirás un enlace de recuperación." });
    }

    const user = users[0];
    const resetToken = generateResetToken();
    const resetOtp = generateResetOtp();
    const tokenSalt = createResetSalt();
    const otpSalt = createResetSalt();
    const tokenHash = hashResetSecret(resetToken, tokenSalt);
    const otpHash = hashResetSecret(resetOtp, otpSalt);
    const expiresAt = new Date(Date.now() + 15 * 60_000);

    const [reset] = (await db`
      INSERT INTO stylehub_password_resets (
        user_id,
        token_hash,
        token_salt,
        otp_hash,
        otp_salt,
        attempts,
        expires_at
      )
      VALUES (
        ${user.id},
        ${tokenHash},
        ${tokenSalt},
        ${otpHash},
        ${otpSalt},
        0,
        ${expiresAt}
      )
      RETURNING id
    `) as Array<{ id: string }>;

    const resetUrl = `${new URL(request.url).origin}/restablecer-contrasena?rid=${reset.id}&token=${resetToken}`;

    await sendPasswordResetEmail({
      to: user.email,
      resetUrl,
      otp: resetOtp,
      recipientName: user.first_name ?? undefined,
    });

    return NextResponse.json({ success: true, message: "Si el correo existe, recibirás un enlace de recuperación." });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo solicitar la recuperación." }, { status: 500 });
  }
}
