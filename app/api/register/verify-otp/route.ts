import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";
import { hashOtpCode } from "@/lib/otp";

export const runtime = "nodejs";

type VerifyOtpPayload = {
  email?: string;
  code?: string;
};

function toText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as VerifyOtpPayload;
    const email = toText(body.email).toLowerCase();
    const code = toText(body.code);

    if (!email || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: "Ingresa un correo y un código de 6 dígitos." }, { status: 400 });
    }

    const db = getDb();
    await ensureStylehubSchema();

    const records = (await db`
      SELECT
        o.id AS otp_id,
        o.user_id,
        u.account_type,
        o.code_hash,
        o.code_salt,
        o.attempts,
        o.expires_at
      FROM stylehub_otps o
      INNER JOIN stylehub_users u ON u.id = o.user_id
      WHERE u.email = ${email} AND o.verified_at IS NULL
      ORDER BY o.created_at DESC
      LIMIT 1
    `) as Array<{
      otp_id: string;
      user_id: string;
      account_type: "cliente" | "negocio";
      code_hash: string;
      code_salt: string;
      attempts: number;
      expires_at: string;
    }>;

    if (records.length === 0) {
      return NextResponse.json({ error: "No encontramos un OTP activo para este correo." }, { status: 404 });
    }

    const record = records[0];

    if (record.attempts >= 5) {
      return NextResponse.json({ error: "Demasiados intentos. Solicita un nuevo código." }, { status: 429 });
    }

    if (new Date(record.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "El OTP expiró. Solicita uno nuevo." }, { status: 410 });
    }

    const expectedHash = hashOtpCode(code, record.code_salt);

    if (expectedHash !== record.code_hash) {
      await db`
        UPDATE stylehub_otps
        SET attempts = attempts + 1
        WHERE id = ${record.otp_id}
      `;

      return NextResponse.json({ error: "El código OTP no coincide." }, { status: 400 });
    }

    await db`
      UPDATE stylehub_users
      SET email_verified = TRUE,
          verified_at = NOW(),
          updated_at = NOW()
      WHERE id = ${record.user_id}
    `;

    await db`
      UPDATE stylehub_otps
      SET verified_at = NOW()
      WHERE id = ${record.otp_id}
    `;

    const redirectTo = record.account_type === "negocio" ? "/dashboard/negocio" : "/dashboard/cliente";

    return NextResponse.json({
      success: true,
      message: "Registro verificado correctamente.",
      redirectTo,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo verificar el OTP." }, { status: 500 });
  }
}