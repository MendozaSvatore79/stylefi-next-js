import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";
import { sendOtpEmail } from "@/lib/email";
import { OTP_TTL_MINUTES, createOtpSalt, generateOtpCode, hashOtpCode } from "@/lib/otp";
import { hashPassword } from "@/lib/password";
import { saveProfileImage } from "@/lib/profile-image";

export const runtime = "nodejs";

function toText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getFormText(formData: FormData, key: string): string {
  return toText(formData.get(key));
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const accountType = getFormText(formData, "accountType") === "negocio" ? "negocio" : "cliente";
    const firstName = getFormText(formData, "firstName");
    const lastName = getFormText(formData, "lastName");
    const businessName = getFormText(formData, "businessName");
    const rfc = getFormText(formData, "rfc");
    const phone = getFormText(formData, "phone");
    const email = getFormText(formData, "email").toLowerCase();
    const password = getFormText(formData, "password");
    const profileImageEntry = formData.get("profileImage");

    if (!email || !phone || !password) {
      return NextResponse.json({ error: "Completa correo, teléfono y contraseña." }, { status: 400 });
    }

    if (accountType === "cliente" && (!firstName || !lastName)) {
      return NextResponse.json({ error: "Completa nombre y apellidos." }, { status: 400 });
    }

    if (accountType === "negocio" && (!firstName || !lastName || !businessName || !rfc)) {
      return NextResponse.json({ error: "Completa los datos del negocio." }, { status: 400 });
    }

    const db = getDb();
    await ensureStylehubSchema();

    let profileImageName: string | null = null;
    if (profileImageEntry instanceof File && profileImageEntry.size > 0) {
      profileImageName = await saveProfileImage(profileImageEntry);
    }

    const existingUsers = (await db`
      SELECT email_verified
      FROM stylehub_users
      WHERE email = ${email}
      LIMIT 1
    `) as Array<{ email_verified: boolean }>;

    if (existingUsers.length > 0 && existingUsers[0].email_verified) {
      return NextResponse.json({ error: "Este correo ya está registrado." }, { status: 409 });
    }

    const passwordHash = hashPassword(password);

    const [user] = (await db`
      INSERT INTO stylehub_users (
        account_type,
        first_name,
        last_name,
        business_name,
        rfc,
        phone,
        email,
        password_hash,
        profile_image_name,
        email_verified,
        updated_at
      )
      VALUES (
        ${accountType},
        ${firstName || null},
        ${lastName || null},
        ${businessName || null},
        ${rfc || null},
        ${phone},
        ${email},
        ${passwordHash},
        ${profileImageName},
        FALSE,
        NOW()
      )
      ON CONFLICT (email) DO UPDATE SET
        account_type = EXCLUDED.account_type,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        business_name = EXCLUDED.business_name,
        rfc = EXCLUDED.rfc,
        phone = EXCLUDED.phone,
        password_hash = EXCLUDED.password_hash,
        profile_image_name = COALESCE(EXCLUDED.profile_image_name, stylehub_users.profile_image_name),
        email_verified = FALSE,
        updated_at = NOW(),
        verified_at = NULL
      RETURNING id, email, first_name, last_name
    `) as Array<{
      id: string;
      email: string;
      first_name: string | null;
      last_name: string | null;
    }>;

    const code = generateOtpCode();
    const salt = createOtpSalt();
    const codeHash = hashOtpCode(code, salt);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

    await db`
      INSERT INTO stylehub_otps (user_id, code_hash, code_salt, expires_at)
      VALUES (${user.id}, ${codeHash}, ${salt}, ${expiresAt})
    `;

    await sendOtpEmail({
      to: user.email,
      code,
      recipientName: user.first_name ?? undefined,
    });

    return NextResponse.json({
      success: true,
      email: user.email,
      message: "OTP enviado por correo.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo completar el registro." }, { status: 500 });
  }
}