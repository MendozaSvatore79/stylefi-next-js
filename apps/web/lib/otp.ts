import crypto from "node:crypto";

export const OTP_LENGTH = 6;
export const OTP_TTL_MINUTES = 10;

export function generateOtpCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(OTP_LENGTH, "0");
}

export function createOtpSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function hashOtpCode(code: string, salt: string): string {
  return crypto.createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");

  return `scrypt$${salt}$${derivedKey}`;
}
