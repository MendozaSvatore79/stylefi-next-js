import { readFileSync } from "node:fs";
import path from "node:path";

import { esMX } from "@clerk/localizations";
import { describe, expect, it } from "vitest";

import { localizacionClerk, MENSAJE_CUENTA_SUSPENDIDA } from "@/lib/sesion-localizacion";

const layout = readFileSync(path.resolve(import.meta.dirname, "..", "app/(con-sesion)/layout.tsx"), "utf8");

describe("traducción de Clerk: cuenta suspendida en español", () => {
  it("Clerk busca el error como unstable__errors.user_banned: está, en español", () => {
    expect((localizacionClerk.unstable__errors as Record<string, unknown>).user_banned).toBe(MENSAJE_CUENTA_SUSPENDIDA);
    expect(MENSAJE_CUENTA_SUSPENDIDA).toMatch(/suspendida/);
    expect(MENSAJE_CUENTA_SUSPENDIDA).not.toMatch(/banned/i);
  });

  it("conserva el resto de esMX (textos y errores)", () => {
    expect(localizacionClerk.signIn).toBe(esMX.signIn);
    for (const [clave, valor] of Object.entries(esMX.unstable__errors ?? {})) {
      expect((localizacionClerk.unstable__errors as Record<string, unknown>)[clave]).toEqual(valor);
    }
  });

  it("el ClerkProvider usa esta traducción", () => {
    expect(layout).toContain('import { localizacionClerk } from "@/lib/sesion-localizacion";');
    expect(layout).toContain("localization={localizacionClerk}");
  });
});
