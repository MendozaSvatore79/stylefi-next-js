import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const RAIZ = path.resolve(import.meta.dirname, "..");
const contexto = readFileSync(path.join(RAIZ, "lib/language-context.tsx"), "utf8");

/** Claves de un bloque del diccionario (`es: { … }` o `en: { … }`). */
function clavesDe(idioma: "es" | "en"): Set<string> {
  const inicio = contexto.indexOf(`  ${idioma}: {`);
  const fin = contexto.indexOf("\n  },", inicio);
  return new Set([...contexto.slice(inicio, fin).matchAll(/^\s+"([^"]+)":/gm)].map((m) => m[1]));
}

/** Claves usadas con t("…") en el código (.ts/.tsx de app, components y lib). */
function clavesUsadas(): Map<string, string> {
  const usadas = new Map<string, string>();
  const recorrer = (dir: string) => {
    for (const nombre of readdirSync(dir)) {
      const ruta = path.join(dir, nombre);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else if (/\.tsx?$/.test(nombre)) {
        for (const m of readFileSync(ruta, "utf8").matchAll(/\bt\("([A-Za-z0-9_.]+)"\)/g)) usadas.set(m[1], path.relative(RAIZ, ruta));
      }
    }
  };
  for (const dir of ["app", "components", "lib"]) recorrer(path.join(RAIZ, dir));
  return usadas;
}

const es = clavesDe("es");
const en = clavesDe("en");
const usadas = clavesUsadas();

describe("claves de idioma: t() muestra la clave cruda si falta", () => {
  it("encuentra el diccionario y las claves usadas (la prueba no está vacía)", () => {
    expect(es.size).toBeGreaterThan(100);
    expect(en.size).toBeGreaterThan(100);
    expect(usadas.size).toBeGreaterThan(100);
  });

  it("toda clave usada existe en español", () => {
    const faltan = [...usadas].filter(([clave]) => !es.has(clave)).map(([clave, archivo]) => `${clave} (${archivo})`);
    expect(faltan).toEqual([]);
  });

  it("toda clave usada existe en inglés", () => {
    const faltan = [...usadas].filter(([clave]) => !en.has(clave)).map(([clave, archivo]) => `${clave} (${archivo})`);
    expect(faltan).toEqual([]);
  });
});
