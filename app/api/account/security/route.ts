import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authConfig } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";
import { sendAccountDeletionTokenEmail } from "@/lib/email";
import { createOtpSalt, generateOtpCode, hashOtpCode } from "@/lib/otp";
import { hashPassword, verifyPassword } from "@/lib/password";

export const runtime = "nodejs";

type UserSecurityRow = {
  id: string;
  email: string;
  account_type: "cliente" | "negocio";
  password_hash: string | null;
  first_name: string | null;
  business_name: string | null;
};

async function resolveCurrentUser() {
  const session = await getServerSession(authConfig);

  if (!session?.user) {
    return { error: NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 }) } as const;
  }

  await ensureStylehubSchema();
  const db = getDb();

  const byId = session.user.id
    ? ((await db`
        SELECT id, email, account_type, password_hash, first_name, business_name
        FROM stylehub_users
        WHERE id = ${session.user.id}
        LIMIT 1
      `) as UserSecurityRow[])
    : [];

  if (byId[0]) {
    return { db, user: byId[0] } as const;
  }

  const email = session.user.email?.trim().toLowerCase();
  if (!email) {
    return { error: NextResponse.json({ error: "No se encontró el correo del usuario." }, { status: 400 }) } as const;
  }

  const byEmail = (await db`
    SELECT id, email, account_type, password_hash, first_name, business_name
    FROM stylehub_users
    WHERE email = ${email}
    LIMIT 1
  `) as UserSecurityRow[];

  if (!byEmail[0]) {
    return { error: NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 }) } as const;
  }

  return { db, user: byEmail[0] } as const;
}

export async function GET() {
  const resolved = await resolveCurrentUser();
  if ("error" in resolved) {
    return resolved.error;
  }

  try {
    const oauthProviders = (await resolved.db`
      SELECT DISTINCT provider
      FROM stylehub_oauth_accounts
      WHERE user_id = ${resolved.user.id}
      ORDER BY provider ASC
    `) as Array<{ provider: string }>;

    const providers = oauthProviders.map((item) => item.provider);

    return NextResponse.json({
      email: resolved.user.email,
      accountType: resolved.user.account_type,
      hasPassword: Boolean(resolved.user.password_hash),
      hasGoogle: providers.includes("google"),
      providers,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo cargar la seguridad de la cuenta." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const resolved = await resolveCurrentUser();
  if ("error" in resolved) {
    return resolved.error;
  }

  try {
    const payload = (await request.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };

    const currentPassword = (payload.currentPassword ?? "").trim();
    const newPassword = (payload.newPassword ?? "").trim();

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "La nueva contraseña debe tener al menos 8 caracteres." }, { status: 400 });
    }

    if (resolved.user.password_hash) {
      if (!currentPassword) {
        return NextResponse.json({ error: "Debes ingresar tu contraseña actual." }, { status: 400 });
      }

      if (!verifyPassword(currentPassword, resolved.user.password_hash)) {
        return NextResponse.json({ error: "La contraseña actual no es correcta." }, { status: 401 });
      }
    }

    const newHash = hashPassword(newPassword);

    await resolved.db`
      UPDATE stylehub_users
      SET password_hash = ${newHash},
          updated_at = NOW()
      WHERE id = ${resolved.user.id}
    `;

    return NextResponse.json({ ok: true, mode: resolved.user.password_hash ? "updated" : "created" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo actualizar la contraseña." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const resolved = await resolveCurrentUser();
  if ("error" in resolved) {
    return resolved.error;
  }

  try {
    const payload = (await request.json()) as {
      confirmation?: string;
    };

    const confirmation = (payload.confirmation ?? "").trim().toLowerCase();

    if (!confirmation || confirmation !== resolved.user.email.toLowerCase()) {
      return NextResponse.json(
        { error: "Para enviar el token, confirma escribiendo tu correo exactamente." },
        { status: 400 },
      );
    }

    const token = generateOtpCode();
    const tokenSalt = createOtpSalt();
    const tokenHash = hashOtpCode(token, tokenSalt);
    const expiresAt = new Date(Date.now() + 10 * 60_000);

    await resolved.db`
      DELETE FROM stylehub_account_deletion_tokens
      WHERE user_id = ${resolved.user.id}
        AND (used_at IS NOT NULL OR expires_at < NOW())
    `;

    await resolved.db`
      INSERT INTO stylehub_account_deletion_tokens (
        user_id,
        token_hash,
        token_salt,
        attempts,
        expires_at
      )
      VALUES (
        ${resolved.user.id},
        ${tokenHash},
        ${tokenSalt},
        0,
        ${expiresAt}
      )
    `;

    await sendAccountDeletionTokenEmail({
      to: resolved.user.email,
      token,
      recipientName: resolved.user.first_name ?? resolved.user.business_name ?? undefined,
    });

    return NextResponse.json({
      ok: true,
      message: "Enviamos un token de confirmación a tu correo. Vence en 10 minutos.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo enviar el token de eliminación." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const resolved = await resolveCurrentUser();
  if ("error" in resolved) {
    return resolved.error;
  }

  try {
    const payload = (await request.json()) as {
      confirmation?: string;
      token?: string;
    };

    const confirmation = (payload.confirmation ?? "").trim();
    const token = (payload.token ?? "").trim();

    if (confirmation.toLowerCase() !== resolved.user.email.toLowerCase()) {
      return NextResponse.json(
        { error: "Para eliminar la cuenta debes confirmar escribiendo tu correo exactamente." },
        { status: 400 },
      );
    }

    if (!/^\d{6}$/.test(token)) {
      return NextResponse.json({ error: "Ingresa el token de 6 dígitos enviado a tu correo." }, { status: 400 });
    }

    const activeTokens = (await resolved.db`
      SELECT id, token_hash, token_salt, attempts, expires_at
      FROM stylehub_account_deletion_tokens
      WHERE user_id = ${resolved.user.id}
        AND used_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `) as Array<{
      id: string;
      token_hash: string;
      token_salt: string;
      attempts: number;
      expires_at: string;
    }>;

    if (!activeTokens[0]) {
      return NextResponse.json({ error: "Primero solicita un token de eliminación por correo." }, { status: 404 });
    }

    const activeToken = activeTokens[0];

    if (new Date(activeToken.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "El token expiró. Solicita uno nuevo." }, { status: 410 });
    }

    if (activeToken.attempts >= 5) {
      return NextResponse.json({ error: "Demasiados intentos. Solicita un nuevo token." }, { status: 429 });
    }

    const tokenHash = hashOtpCode(token, activeToken.token_salt);
    if (tokenHash !== activeToken.token_hash) {
      await resolved.db`
        UPDATE stylehub_account_deletion_tokens
        SET attempts = attempts + 1
        WHERE id = ${activeToken.id}
      `;

      return NextResponse.json({ error: "El token no coincide." }, { status: 400 });
    }

    await resolved.db`
      UPDATE stylehub_account_deletion_tokens
      SET used_at = NOW()
      WHERE id = ${activeToken.id}
    `;

    await resolved.db`
      DELETE FROM stylehub_users
      WHERE id = ${resolved.user.id}
    `;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo eliminar la cuenta." }, { status: 500 });
  }
}
