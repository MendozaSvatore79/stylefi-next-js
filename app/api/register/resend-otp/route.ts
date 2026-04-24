import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";
import { sendOtpEmail } from "@/lib/email";
import { OTP_TTL_MINUTES, createOtpSalt, generateOtpCode, hashOtpCode } from "@/lib/otp";

export const runtime = "nodejs";

type ResendOtpPayload = {
  email?: string;
};

function toText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ResendOtpPayload;
    const email = toText(body.email).toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Ingresa un correo válido." }, { status: 400 });
    }

    const db = getDb();
    await ensureStylehubSchema();

    const users = (await db`
      SELECT id, first_name, email_verified
      FROM stylehub_users
      WHERE email = ${email}
      LIMIT 1
    `) as Array<{ id: string; first_name: string | null; email_verified: boolean }>;

    if (users.length === 0) {
      return NextResponse.json({ error: "No encontramos una cuenta con ese correo." }, { status: 404 });
    }

    if (users[0].email_verified) {
      return NextResponse.json({ error: "Este correo ya está verificado." }, { status: 409 });
    }

    const code = generateOtpCode();
    const salt = createOtpSalt();
    const codeHash = hashOtpCode(code, salt);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

    await db`
      INSERT INTO stylehub_otps (user_id, code_hash, code_salt, expires_at)
      VALUES (${users[0].id}, ${codeHash}, ${salt}, ${expiresAt})
    `;

    await sendOtpEmail({
      to: email,
      code,
      recipientName: users[0].first_name ?? undefined,
    });

    return NextResponse.json({ success: true, message: "OTP reenviado por correo." });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo reenviar el OTP." }, { status: 500 });
  }
}
