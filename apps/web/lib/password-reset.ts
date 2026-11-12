import crypto from "node:crypto";

import { generateOtpCode } from "@/lib/otp";

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function generateResetOtp(): string {
  return generateOtpCode();
}

export function createResetSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function hashResetSecret(secret: string, salt: string): string {
  return crypto.createHash("sha256").update(`${salt}:${secret}`).digest("hex");
}
