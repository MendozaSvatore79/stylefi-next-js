import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";
import { getOptionalEnv } from "@/lib/env";
import { verifyPassword } from "@/lib/password";

export const runtime = "nodejs";

type LoginPayload = {
  email?: string;
  password?: string;
};

function toText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalize(value: string | undefined): string | undefined {
  return value?.trim().replace(/^['\"]+|['\"]+$/g, "");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginPayload;
    const email = toText(body.email).toLowerCase();
    const password = toText(body.password);

    if (!email || !password) {
      return NextResponse.json({ error: "Ingresa correo y contraseña." }, { status: 400 });
    }

    const adminEmail = normalize(getOptionalEnv("ADMIN_EMAIL"));
    const adminPassword = normalize(getOptionalEnv("ADMIN_PASSWORD"));

    if (adminEmail && adminPassword && email === adminEmail.toLowerCase() && password === adminPassword) {
      return NextResponse.json({
        success: true,
        role: "admin",
        redirectTo: "/dashboard/admin",
        message: "Bienvenido, administrador.",
      });
    }

    const db = getDb();
    await ensureStylehubSchema();

    const users = (await db`
      SELECT id, email, password_hash, account_type, email_verified
      FROM stylehub_users
      WHERE email = ${email}
      LIMIT 1
    `) as Array<{
      id: string;
      email: string;
      password_hash: string;
      account_type: "cliente" | "negocio";
      email_verified: boolean;
    }>;

    if (users.length === 0) {
      return NextResponse.json({ error: "No encontramos una cuenta con ese correo." }, { status: 404 });
    }

    const user = users[0];

    if (!user.email_verified) {
      return NextResponse.json({ error: "Primero verifica tu correo con el OTP." }, { status: 403 });
    }

    if (!verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ error: "La contraseña es incorrecta." }, { status: 401 });
    }

    const redirectTo = user.account_type === "negocio" ? "/dashboard/negocio" : "/dashboard/cliente";

    return NextResponse.json({
      success: true,
      role: user.account_type,
      redirectTo,
      message: "Inicio de sesión exitoso.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo iniciar sesión." }, { status: 500 });
  }
}
