/**
 * La portada pregunta el modo mantenimiento a GET /live-dashboard sin token y con caché de 30 s, para que cada
 * visita no llegue al backend (guardia sobre el código; no hay pruebas de componentes en el proyecto).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const fuente = readFileSync(path.resolve(import.meta.dirname, "..", "app/page.tsx"), "utf8");
const inicio = fuente.indexOf("async function enMantenimiento");
const funcion = fuente.slice(inicio, fuente.indexOf("\n}\n", inicio));

describe("portada: caché de /live-dashboard", () => {
  it("llama al backend directo con revalidate de 30 s", () => {
    expect(inicio).toBeGreaterThan(-1);
    expect(fuente).toContain("const REVALIDAR_MANTENIMIENTO_S = 30;");
    expect(funcion).toContain("fetch(`${base}/live-dashboard`, { next: { revalidate: REVALIDAR_MANTENIMIENTO_S } })");
  });

  it("no pasa por apiServidor (fuerza no-store) ni manda el token", () => {
    expect(fuente).not.toContain("apiServidor(");
    expect(fuente).not.toContain("@/lib/api-servidor");
    expect(funcion).not.toMatch(/no-store|Authorization|getToken|headers/);
  });

  it("si no hay backend configurado o falla, muestra la portada normal", () => {
    expect(funcion).toContain("if (!base) return false;");
    expect(funcion).toMatch(/catch \{\s*return false;\s*\}/);
  });
});
