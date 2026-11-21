/**
 * Todo inicio de sesión o registro debe terminar en /entrar (que manda al panel o a /registro/completar). Clerk cambia
 * de flujo con Google: desde /register con una cuenta que ya existe pasa a inicio de sesión, y desde /iniciar-sesion
 * con una cuenta nueva pasa a registro. Sin el destino del flujo cruzado, Clerk mandaba a "/".
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const leer = (archivo: string) => readFileSync(path.resolve(import.meta.dirname, "..", archivo), "utf8");
const etiqueta = (fuente: string, componente: string) => {
  const m = fuente.match(new RegExp(`<${componente}\\b[\\s\\S]*?/>`));
  expect(m, `<${componente}>`).not.toBeNull();
  return m![0];
};

describe("destinos de Clerk", () => {
  it("<ClerkProvider> manda a /entrar después de entrar y de registrarse", () => {
    const proveedor = leer("app/(con-sesion)/layout.tsx").match(/<ClerkProvider\b[\s\S]*?>/)![0];
    expect(proveedor).toContain('signInForceRedirectUrl="/entrar"');
    expect(proveedor).toContain('signUpForceRedirectUrl="/entrar"');
  });

  it("<SignIn> manda a /entrar también cuando Clerk pasa a registro (Google con cuenta nueva)", () => {
    const signIn = etiqueta(leer("app/(con-sesion)/iniciar-sesion/[[...resto]]/page.tsx"), "SignIn");
    expect(signIn).toMatch(/\sforceRedirectUrl="\/entrar"/);
    expect(signIn).toContain('signUpForceRedirectUrl="/entrar"');
  });

  it("<SignUp> manda a /entrar también cuando Clerk pasa a inicio de sesión (Google con cuenta existente)", () => {
    const signUp = etiqueta(leer("app/(con-sesion)/register/[[...resto]]/page.tsx"), "SignUp");
    expect(signUp).toMatch(/\sforceRedirectUrl="\/entrar"/);
    expect(signUp).toContain('signInForceRedirectUrl="/entrar"');
  });
});
