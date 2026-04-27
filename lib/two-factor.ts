import { randomBytes } from "crypto";

import QRCode from "qrcode";
import { generateSecret, generateURI, verifySync } from "otplib";

import { createOtpSalt, generateOtpCode, hashOtpCode } from "@/lib/otp";

export type TwoFactorMethod = "email" | "authenticator";
export type TwoFactorPurpose = "enable_email" | "enable_authenticator" | "verify_session" | "disable";

export function normalizeTwoFactorMethod(value: string | null | undefined): TwoFactorMethod | null {
  if (value === "email" || value === "authenticator") {
    return value;
  }

  return null;
}

export function normalizeTwoFactorPurpose(value: string | null | undefined): TwoFactorPurpose | null {
  if (value === "enable_email" || value === "enable_authenticator" || value === "verify_session" || value === "disable") {
    return value;
  }

  return null;
}

export function normalizeReverifyInterval(value: number | null | undefined) {
  const allowedValues = [30, 60, 180, 360, 720, 1440];
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return 180;
  }

  const roundedValue = Math.round(parsedValue);
  return allowedValues.includes(roundedValue) ? roundedValue : 180;
}

export function shouldRequireTwoFactorRecheck(params: {
  enabled: boolean;
  lastVerifiedAt: string | Date | null;
  reverifyIntervalMinutes: number;
}) {
  if (!params.enabled) {
    return false;
  }

  if (!params.lastVerifiedAt) {
    return true;
  }

  const lastVerified = new Date(params.lastVerifiedAt).getTime();
  if (!Number.isFinite(lastVerified)) {
    return true;
  }

  const elapsedMillis = Date.now() - lastVerified;
  const thresholdMillis = normalizeReverifyInterval(params.reverifyIntervalMinutes) * 60_000;
  return elapsedMillis >= thresholdMillis;
}

export function generateAuthenticatorSecret() {
  return generateSecret({ length: 20 });
}

export function buildAuthenticatorOtpAuthUrl(params: {
  secret: string;
  accountLabel: string;
  issuer?: string;
}) {
  const issuer = params.issuer?.trim() || "STYLEHUB";
  return generateURI({
    strategy: "totp",
    issuer,
    label: params.accountLabel,
    secret: params.secret,
    period: 30,
  });
}

export async function generateAuthenticatorQrDataUrl(otpAuthUrl: string) {
  return QRCode.toDataURL(otpAuthUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 240,
  });
}

export function verifyAuthenticatorToken(params: {
  secret: string;
  token: string;
}) {
  const result = verifySync({
    strategy: "totp",
    token: params.token,
    secret: params.secret,
    period: 30,
    epochTolerance: 30,
  });

  return Boolean(result.valid);
}

export function createTwoFactorEmailCode() {
  const code = generateOtpCode();
  const salt = createOtpSalt();
  const hash = hashOtpCode(code, salt);

  return {
    code,
    salt,
    hash,
    expiresAt: new Date(Date.now() + 10 * 60_000),
  };
}

export function verifyTwoFactorEmailCode(params: {
  code: string;
  salt: string;
  hash: string;
}) {
  const candidateHash = hashOtpCode(params.code, params.salt);
  return candidateHash === params.hash;
}

export function createTwoFactorChallengeToken() {
  return randomBytes(24).toString("hex");
}

export function maskEmailAddress(email: string) {
  const [namePart = "", domainPart = ""] = email.split("@");
  if (!namePart || !domainPart) {
    return email;
  }

  const visibleStart = namePart.slice(0, 2);
  return `${visibleStart}${"*".repeat(Math.max(namePart.length - 2, 2))}@${domainPart}`;
}
