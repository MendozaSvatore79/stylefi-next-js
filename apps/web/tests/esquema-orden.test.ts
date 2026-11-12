/**
 * ensureStylehubSchema() debe poder crear el esquema en una base vacía: ninguna sentencia puede hacer
 * referencia (REFERENCES) a una tabla que todavía no se creó. Antes la tabla de citas se creaba antes que
 * sucursales y servicios, y una base nueva fallaba con 42P01 (comprobado contra Neon el 2026-11-12).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const fuente = readFileSync(path.resolve(import.meta.dirname, "../lib/db-init.ts"), "utf8");
const sentencias = [...fuente.matchAll(/await db`([\s\S]*?)`;/g)].map((m) => m[1]);

describe("orden de creación del esquema", () => {
  it("se leen todas las sentencias", () => {
    expect(sentencias.length).toBeGreaterThan(60);
  });

  it("ninguna sentencia hace referencia a una tabla que se crea después", () => {
    const creadas = new Set<string>();
    const problemas: string[] = [];
    for (const sql of sentencias) {
      const nueva = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
      if (nueva) creadas.add(nueva);
      for (const [, tabla] of sql.matchAll(/REFERENCES (\w+)\s*\(/g)) {
        if (!creadas.has(tabla)) problemas.push(`${nueva ?? sql.trim().split("\n")[0]} → ${tabla}`);
      }
      for (const [, tabla] of sql.matchAll(/(?:ALTER TABLE|CREATE (?:UNIQUE )?INDEX IF NOT EXISTS \w+\s+ON)\s+(\w+)/g)) {
        if (!creadas.has(tabla)) problemas.push(`modifica ${tabla} antes de crearla`);
      }
    }
    expect(problemas).toEqual([]);
  });

  it("la tabla de citas se crea después de sucursales, servicios y estilistas", () => {
    const pos = (t: string) => fuente.indexOf(`CREATE TABLE IF NOT EXISTS ${t} (`);
    for (const previa of ["stylehub_business_branches", "stylehub_business_services", "stylehub_business_stylists"]) {
      expect(pos("stylehub_client_appointments")).toBeGreaterThan(pos(previa));
    }
  });
});
