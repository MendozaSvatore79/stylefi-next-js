import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authConfig } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";
import { sendAccountDeletionTokenEmail, sendTwoFactorCodeEmail } from "@/lib/email";
import { createOtpSalt, generateOtpCode, hashOtpCode } from "@/lib/otp";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  buildAuthenticatorOtpAuthUrl,
  createTwoFactorChallengeToken,
  createTwoFactorEmailCode,
  generateAuthenticatorQrDataUrl,
  generateAuthenticatorSecret,
  maskEmailAddress,
  normalizeReverifyInterval,
  normalizeTwoFactorMethod,
  normalizeTwoFactorPurpose,
  shouldRequireTwoFactorRecheck,
  verifyAuthenticatorToken,
  verifyTwoFactorEmailCode,
  type TwoFactorMethod,
  type TwoFactorPurpose,
} from "@/lib/two-factor";

export const runtime = "nodejs";

type UserSecurityRow = {
  id: string;
  email: string;
  account_type: "cliente" | "negocio";
  password_hash: string | null;
  first_name: string | null;
  business_name: string | null;
};

type TwoFactorSettingsRow = {
  user_id: string;
  enabled: boolean;
  preferred_method: TwoFactorMethod | null;
  totp_secret: string | null;
  reverify_interval_minutes: number;
  last_verified_at: string | null;
};

type TwoFactorChallengeRow = {
  id: string;
  user_id: string;
  method: TwoFactorMethod;
  purpose: TwoFactorPurpose;
  challenge_token: string | null;
  code_hash: string | null;
  code_salt: string | null;
  attempts: number;
  metadata: Record<string, unknown>;
  expires_at: string;
  used_at: string | null;
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

async function ensureTwoFactorSettingsRow(db: ReturnType<typeof getDb>, userId: string) {
  await db`
    INSERT INTO stylehub_user_two_factor_settings (
      user_id,
      enabled,
      preferred_method,
      reverify_interval_minutes,
      created_at,
      updated_at
    )
    VALUES (
      ${userId},
      FALSE,
      NULL,
      180,
      NOW(),
      NOW()
    )
    ON CONFLICT (user_id) DO NOTHING
  `;
}

async function loadTwoFactorSettings(db: ReturnType<typeof getDb>, userId: string) {
  await ensureTwoFactorSettingsRow(db, userId);

  const rows = (await db`
    SELECT user_id, enabled, preferred_method, totp_secret, reverify_interval_minutes, last_verified_at
    FROM stylehub_user_two_factor_settings
    WHERE user_id = ${userId}
    LIMIT 1
  `) as TwoFactorSettingsRow[];

  return rows[0] ?? null;
}

function mapTwoFactorState(settings: TwoFactorSettingsRow | null) {
  const enabled = Boolean(settings?.enabled);
  const preferredMethod = settings?.preferred_method ?? null;
  const reverifyIntervalMinutes = normalizeReverifyInterval(settings?.reverify_interval_minutes ?? 180);
  const lastVerifiedAt = settings?.last_verified_at ?? null;
  const hasAuthenticator = Boolean(settings?.totp_secret);

  return {
    enabled,
    preferredMethod,
    hasAuthenticator,
    reverifyIntervalMinutes,
    lastVerifiedAt,
    requiresVerification: shouldRequireTwoFactorRecheck({
      enabled,
      lastVerifiedAt,
      reverifyIntervalMinutes,
    }),
  };
}

async function requireRecentTwoFactor(params: {
  db: ReturnType<typeof getDb>;
  userId: string;
}) {
  const settings = await loadTwoFactorSettings(params.db, params.userId);
  const state = mapTwoFactorState(settings);

  if (!state.enabled) {
    return null;
  }

  if (!state.requiresVerification) {
    return null;
  }

  return NextResponse.json(
    {
      error: "Necesitas verificar tu código 2FA para continuar.",
      code: "two_factor_required",
      twoFactor: state,
    },
    { status: 428 },
  );
}

function resolveTwoFactorPurposeLabel(purpose: TwoFactorPurpose) {
  if (purpose === "enable_email") {
    return "activar 2FA por correo";
  }

  if (purpose === "enable_authenticator") {
    return "activar 2FA por autenticador";
  }

  if (purpose === "disable") {
    return "desactivar 2FA";
  }

  return "verificar tu sesión";
}

async function findActiveChallenge(params: {
  db: ReturnType<typeof getDb>;
  userId: string;
  method: TwoFactorMethod;
  purpose: TwoFactorPurpose;
  challengeId?: string;
}) {
  if (params.challengeId) {
    const byId = (await params.db`
      SELECT id, user_id, method, purpose, challenge_token, code_hash, code_salt, attempts, metadata, expires_at, used_at
      FROM stylehub_user_two_factor_challenges
      WHERE id = ${params.challengeId}
        AND user_id = ${params.userId}
      LIMIT 1
    `) as TwoFactorChallengeRow[];

    return byId[0] ?? null;
  }

  const latest = (await params.db`
    SELECT id, user_id, method, purpose, challenge_token, code_hash, code_salt, attempts, metadata, expires_at, used_at
    FROM stylehub_user_two_factor_challenges
    WHERE user_id = ${params.userId}
      AND method = ${params.method}
      AND purpose = ${params.purpose}
      AND used_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  `) as TwoFactorChallengeRow[];

  return latest[0] ?? null;
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
    const twoFactorSettings = await loadTwoFactorSettings(resolved.db, resolved.user.id);

    return NextResponse.json({
      email: resolved.user.email,
      accountType: resolved.user.account_type,
      hasPassword: Boolean(resolved.user.password_hash),
      hasGoogle: providers.includes("google"),
      providers,
      twoFactor: mapTwoFactorState(twoFactorSettings),
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
      action?: string;
      currentPassword?: string;
      newPassword?: string;
      preferredMethod?: string;
      reverifyIntervalMinutes?: number;
    };

    if (payload.action === "twoFactorPreferences") {
      const preferredMethod = normalizeTwoFactorMethod(payload.preferredMethod);
      const reverifyIntervalMinutes = normalizeReverifyInterval(payload.reverifyIntervalMinutes);
      const settings = await loadTwoFactorSettings(resolved.db, resolved.user.id);

      if (!preferredMethod) {
        return NextResponse.json({ error: "Selecciona un método 2FA válido." }, { status: 400 });
      }

      if (preferredMethod === "authenticator" && !settings?.totp_secret) {
        return NextResponse.json({ error: "Primero vincula una app autenticadora con QR." }, { status: 400 });
      }

      await resolved.db`
        UPDATE stylehub_user_two_factor_settings
        SET preferred_method = ${preferredMethod},
            reverify_interval_minutes = ${reverifyIntervalMinutes},
            updated_at = NOW()
        WHERE user_id = ${resolved.user.id}
      `;

      const updatedSettings = await loadTwoFactorSettings(resolved.db, resolved.user.id);
      return NextResponse.json({ ok: true, twoFactor: mapTwoFactorState(updatedSettings) });
    }

    const twoFactorError = await requireRecentTwoFactor({
      db: resolved.db,
      userId: resolved.user.id,
    });

    if (twoFactorError) {
      return twoFactorError;
    }

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
      action?: string;
      confirmation?: string;
      method?: string;
      purpose?: string;
      code?: string;
      challengeId?: string;
      challengeToken?: string;
    };

    if (payload.action === "twoFactorCreateAuthenticatorSetup") {
      const secret = generateAuthenticatorSecret();
      const accountLabel = resolved.user.email;
      const issuer = "STYLEHUB";
      const otpAuthUrl = buildAuthenticatorOtpAuthUrl({ secret, accountLabel, issuer });
      const qrDataUrl = await generateAuthenticatorQrDataUrl(otpAuthUrl);
      const challengeToken = createTwoFactorChallengeToken();
      const expiresAt = new Date(Date.now() + 10 * 60_000);

      const rows = (await resolved.db`
        INSERT INTO stylehub_user_two_factor_challenges (
          user_id,
          method,
          purpose,
          challenge_token,
          metadata,
          expires_at
        )
        VALUES (
          ${resolved.user.id},
          'authenticator',
          'enable_authenticator',
          ${challengeToken},
          ${JSON.stringify({ pendingSecret: secret })}::jsonb,
          ${expiresAt}
        )
        RETURNING id
      `) as Array<{ id: string }>;

      return NextResponse.json({
        ok: true,
        setupId: rows[0]?.id,
        challengeToken,
        manualKey: secret,
        otpAuthUrl,
        qrDataUrl,
      });
    }

    if (payload.action === "twoFactorSendEmailCode") {
      const purpose = normalizeTwoFactorPurpose(payload.purpose) ?? "verify_session";
      const emailChallenge = createTwoFactorEmailCode();

      const challengeRows = (await resolved.db`
        INSERT INTO stylehub_user_two_factor_challenges (
          user_id,
          method,
          purpose,
          code_hash,
          code_salt,
          expires_at
        )
        VALUES (
          ${resolved.user.id},
          'email',
          ${purpose},
          ${emailChallenge.hash},
          ${emailChallenge.salt},
          ${emailChallenge.expiresAt}
        )
        RETURNING id
      `) as Array<{ id: string }>;

      await sendTwoFactorCodeEmail({
        to: resolved.user.email,
        code: emailChallenge.code,
        recipientName: resolved.user.first_name ?? resolved.user.business_name ?? undefined,
        purposeLabel: resolveTwoFactorPurposeLabel(purpose),
      });

      return NextResponse.json({
        ok: true,
        challengeId: challengeRows[0]?.id,
        destination: maskEmailAddress(resolved.user.email),
      });
    }

    if (payload.action === "twoFactorVerify") {
      const purpose = normalizeTwoFactorPurpose(payload.purpose);
      const method = normalizeTwoFactorMethod(payload.method);
      const code = (payload.code ?? "").trim();

      if (!purpose || !method) {
        return NextResponse.json({ error: "Solicitud de verificación 2FA inválida." }, { status: 400 });
      }

      if (!/^\d{6}$/.test(code)) {
        return NextResponse.json({ error: "Ingresa un código válido de 6 dígitos." }, { status: 400 });
      }

      const settings = await loadTwoFactorSettings(resolved.db, resolved.user.id);

      if (method === "email") {
        const challenge = await findActiveChallenge({
          db: resolved.db,
          userId: resolved.user.id,
          method,
          purpose,
          challengeId: payload.challengeId,
        });

        if (!challenge || challenge.used_at) {
          return NextResponse.json({ error: "Primero solicita un código por correo." }, { status: 404 });
        }

        if (new Date(challenge.expires_at).getTime() < Date.now()) {
          return NextResponse.json({ error: "El código expiró. Solicita uno nuevo." }, { status: 410 });
        }

        if (challenge.attempts >= 5) {
          return NextResponse.json({ error: "Demasiados intentos. Solicita un nuevo código." }, { status: 429 });
        }

        if (!challenge.code_hash || !challenge.code_salt) {
          return NextResponse.json({ error: "El desafío no es válido." }, { status: 400 });
        }

        const validCode = verifyTwoFactorEmailCode({
          code,
          salt: challenge.code_salt,
          hash: challenge.code_hash,
        });

        if (!validCode) {
          await resolved.db`
            UPDATE stylehub_user_two_factor_challenges
            SET attempts = attempts + 1
            WHERE id = ${challenge.id}
          `;

          return NextResponse.json({ error: "El código no coincide." }, { status: 400 });
        }

        await resolved.db`
          UPDATE stylehub_user_two_factor_challenges
          SET used_at = NOW()
          WHERE id = ${challenge.id}
        `;

        if (purpose === "enable_email") {
          await resolved.db`
            INSERT INTO stylehub_user_two_factor_settings (
              user_id,
              enabled,
              preferred_method,
              reverify_interval_minutes,
              last_verified_at,
              created_at,
              updated_at
            )
            VALUES (
              ${resolved.user.id},
              TRUE,
              'email',
              ${normalizeReverifyInterval(settings?.reverify_interval_minutes ?? 180)},
              NOW(),
              NOW(),
              NOW()
            )
            ON CONFLICT (user_id) DO UPDATE
            SET enabled = TRUE,
                preferred_method = 'email',
                reverify_interval_minutes = ${normalizeReverifyInterval(settings?.reverify_interval_minutes ?? 180)},
                last_verified_at = NOW(),
                updated_at = NOW()
          `;
        } else if (purpose === "disable") {
          await resolved.db`
            UPDATE stylehub_user_two_factor_settings
            SET enabled = FALSE,
                preferred_method = NULL,
                totp_secret = NULL,
                last_verified_at = NULL,
                updated_at = NOW()
            WHERE user_id = ${resolved.user.id}
          `;
        } else {
          await resolved.db`
            UPDATE stylehub_user_two_factor_settings
            SET last_verified_at = NOW(),
                updated_at = NOW()
            WHERE user_id = ${resolved.user.id}
          `;
        }

        const updatedSettings = await loadTwoFactorSettings(resolved.db, resolved.user.id);
        return NextResponse.json({ ok: true, twoFactor: mapTwoFactorState(updatedSettings) });
      }

      if (purpose === "enable_authenticator") {
        const challenge = await findActiveChallenge({
          db: resolved.db,
          userId: resolved.user.id,
          method,
          purpose,
          challengeId: payload.challengeId,
        });

        if (!challenge || challenge.used_at) {
          return NextResponse.json({ error: "Primero genera el QR para configurar tu app." }, { status: 404 });
        }

        if (new Date(challenge.expires_at).getTime() < Date.now()) {
          return NextResponse.json({ error: "La configuración expiró. Genera un nuevo QR." }, { status: 410 });
        }

        if (challenge.attempts >= 5) {
          return NextResponse.json({ error: "Demasiados intentos. Genera un nuevo QR." }, { status: 429 });
        }

        if (challenge.challenge_token && payload.challengeToken && challenge.challenge_token !== payload.challengeToken) {
          return NextResponse.json({ error: "El token de configuración no coincide." }, { status: 401 });
        }

        const pendingSecret = typeof challenge.metadata?.pendingSecret === "string" ? challenge.metadata.pendingSecret : "";
        if (!pendingSecret) {
          return NextResponse.json({ error: "No se encontró el secreto temporal de configuración." }, { status: 400 });
        }

        const validToken = verifyAuthenticatorToken({ secret: pendingSecret, token: code });
        if (!validToken) {
          await resolved.db`
            UPDATE stylehub_user_two_factor_challenges
            SET attempts = attempts + 1
            WHERE id = ${challenge.id}
          `;

          return NextResponse.json({ error: "El código del autenticador no coincide." }, { status: 400 });
        }

        await resolved.db`
          UPDATE stylehub_user_two_factor_challenges
          SET used_at = NOW()
          WHERE id = ${challenge.id}
        `;

        await resolved.db`
          INSERT INTO stylehub_user_two_factor_settings (
            user_id,
            enabled,
            preferred_method,
            totp_secret,
            reverify_interval_minutes,
            last_verified_at,
            created_at,
            updated_at
          )
          VALUES (
            ${resolved.user.id},
            TRUE,
            'authenticator',
            ${pendingSecret},
            ${normalizeReverifyInterval(settings?.reverify_interval_minutes ?? 180)},
            NOW(),
            NOW(),
            NOW()
          )
          ON CONFLICT (user_id) DO UPDATE
          SET enabled = TRUE,
              preferred_method = 'authenticator',
              totp_secret = ${pendingSecret},
              reverify_interval_minutes = ${normalizeReverifyInterval(settings?.reverify_interval_minutes ?? 180)},
              last_verified_at = NOW(),
              updated_at = NOW()
        `;

        const updatedSettings = await loadTwoFactorSettings(resolved.db, resolved.user.id);
        return NextResponse.json({ ok: true, twoFactor: mapTwoFactorState(updatedSettings) });
      }

      if (!settings?.totp_secret) {
        return NextResponse.json({ error: "No tienes un autenticador vinculado todavía." }, { status: 400 });
      }

      const validToken = verifyAuthenticatorToken({
        secret: settings.totp_secret,
        token: code,
      });

      if (!validToken) {
        return NextResponse.json({ error: "El código del autenticador no coincide." }, { status: 400 });
      }

      if (purpose === "disable") {
        await resolved.db`
          UPDATE stylehub_user_two_factor_settings
          SET enabled = FALSE,
              preferred_method = NULL,
              totp_secret = NULL,
              last_verified_at = NULL,
              updated_at = NOW()
          WHERE user_id = ${resolved.user.id}
        `;
      } else {
        await resolved.db`
          UPDATE stylehub_user_two_factor_settings
          SET last_verified_at = NOW(),
              updated_at = NOW()
          WHERE user_id = ${resolved.user.id}
        `;
      }

      const updatedSettings = await loadTwoFactorSettings(resolved.db, resolved.user.id);
      return NextResponse.json({ ok: true, twoFactor: mapTwoFactorState(updatedSettings) });
    }

    const confirmation = (payload.confirmation ?? "").trim().toLowerCase();

    if (!confirmation || confirmation !== resolved.user.email.toLowerCase()) {
      return NextResponse.json(
        { error: "Para enviar el token, confirma escribiendo tu correo exactamente." },
        { status: 400 },
      );
    }

    const twoFactorError = await requireRecentTwoFactor({
      db: resolved.db,
      userId: resolved.user.id,
    });

    if (twoFactorError) {
      return twoFactorError;
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
    return NextResponse.json({ error: "No se pudo completar la operación de seguridad." }, { status: 500 });
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

    const twoFactorError = await requireRecentTwoFactor({
      db: resolved.db,
      userId: resolved.user.id,
    });

    if (twoFactorError) {
      return twoFactorError;
    }

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
