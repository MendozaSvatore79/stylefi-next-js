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

describe("favicon", () => {
  it("es un .ico real con 16, 32 y 48 px y pesa menos de 16 KB (antes, un PNG de 500×500 de 162 KB)", () => {
    const ico = readFileSync(path.resolve(RAIZ, "app/favicon.ico"));
    expect(ico.length).toBeLessThan(16 * 1024);
    expect([ico.readUInt16LE(0), ico.readUInt16LE(2)]).toEqual([0, 1]);
    const n = ico.readUInt16LE(4);
    const tamanos = Array.from({ length: n }, (_, i) => ico[6 + 16 * i] || 256);
    expect(tamanos).toEqual([16, 32, 48]);
  });
});
