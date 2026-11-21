/** Correcciones de la revisión 4 (accesibilidad, favicon y ajustes que no guardaban nada). */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const RAIZ = path.resolve(import.meta.dirname, "..");
const leer = (archivo: string) => readFileSync(path.resolve(RAIZ, archivo), "utf8");

describe("configuración del cliente", () => {
  it("ya no ofrece interruptores de privacidad que no guardaban nada (perfil público, historial, análisis)", () => {
    const pagina = leer("app/dashboard/cliente/configuracion/page.tsx");
    expect(pagina).not.toMatch(/privacy/);
    expect(pagina).toContain('useState<"general" | "security" | "notifications">("general")');
    expect(leer("lib/language-context.tsx")).not.toMatch(/"(settings\.privacy|privacy\.(title|description|profile|history|analytics))/);
  });
});
