import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";
import { hashPassword } from "@/lib/password";
import { hashResetSecret } from "@/lib/password-reset";

export const runtime = "nodejs";

type PasswordResetConfirmPayload = {
  rid?: string;
  token?: string;
  otp?: string;
  password?: string;
};

function toText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PasswordResetConfirmPayload;
    const rid = toText(body.rid);
    const token = toText(body.token);
    const otp = toText(body.otp);
    const password = toText(body.password);

    if (!rid || !token || !/^\d{6}$/.test(otp) || password.length < 8) {
      return NextResponse.json({ error: "Completa el enlace, OTP y una contraseña válida." }, { status: 400 });
    }

    const db = getDb();
    await ensureStylehubSchema();

    const records = (await db`
      SELECT
        r.id,
        r.user_id,
        r.token_hash,
        r.token_salt,
        r.otp_hash,
        r.otp_salt,
        r.attempts,
        r.expires_at,
        r.used_at
      FROM stylehub_password_resets r
      WHERE r.id = ${rid}
      LIMIT 1
    `) as Array<{
      id: string;
      user_id: string;
      token_hash: string;
      token_salt: string;
      otp_hash: string;
      otp_salt: string;
      attempts: number;
      expires_at: string;
      used_at: string | null;
    }>;

    if (records.length === 0) {
      return NextResponse.json({ error: "No encontramos una solicitud de recuperación válida." }, { status: 404 });
    }

    const record = records[0];

    if (record.used_at) {
      return NextResponse.json({ error: "Este enlace ya fue utilizado." }, { status: 410 });
    }

    if (new Date(record.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "El enlace de recuperación expiró." }, { status: 410 });
    }

    if (record.attempts >= 5) {
      return NextResponse.json({ error: "Demasiados intentos. Solicita un nuevo enlace." }, { status: 429 });
    }

    if (hashResetSecret(token, record.token_salt) !== record.token_hash) {
      return NextResponse.json({ error: "El enlace de recuperación no es válido." }, { status: 400 });
    }

    if (hashResetSecret(otp, record.otp_salt) !== record.otp_hash) {
      await db`
        UPDATE stylehub_password_resets
        SET attempts = attempts + 1
        WHERE id = ${record.id}
      `;

      return NextResponse.json({ error: "El OTP no coincide." }, { status: 400 });
    }

    const passwordHash = hashPassword(password);

    await db`
      UPDATE stylehub_users
      SET password_hash = ${passwordHash},
          updated_at = NOW()
      WHERE id = ${record.user_id}
    `;

    await db`
      UPDATE stylehub_password_resets
      SET used_at = NOW()
      WHERE id = ${record.id}
    `;

    return NextResponse.json({ success: true, message: "Contraseña actualizada correctamente." });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo restablecer la contraseña." }, { status: 500 });
  }
}
