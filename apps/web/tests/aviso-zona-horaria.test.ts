/** Registro de negocio: aviso de que STYLEHUB opera con la hora del centro de México (decisión del 2026-11-20). */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const fuente = readFileSync(path.resolve(import.meta.dirname, "../app/registro/completar/completar-registro.tsx"), "utf8");

describe("aviso de zona horaria en el registro", () => {
  it("existe en español e inglés y nombra la hora del centro de México", () => {
    expect(fuente).toContain("hora del centro de México (Ciudad de México)");
    expect(fuente).toContain("central Mexico time (Mexico City)");
  });

  it("solo se muestra a los negocios (dentro del bloque de negocio)", () => {
    const negocio = fuente.indexOf('{tipo === "negocio" ? (');
    const aviso = fuente.indexOf("data-aviso-zona-horaria");
    const cierre = fuente.indexOf("</>", negocio);
    expect(negocio).toBeGreaterThan(-1);
    expect(aviso).toBeGreaterThan(negocio);
    expect(aviso).toBeLessThan(cierre);
  });
});
