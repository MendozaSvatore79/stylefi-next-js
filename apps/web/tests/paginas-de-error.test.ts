/** Pantallas de error (ES/EN) y 404 (no hay pruebas de componentes: función pura más guardia sobre el código). */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { codigoDeError, TEXTO_ERROR } from "@/lib/pagina-error";

const leer = (archivo: string) => readFileSync(path.resolve(import.meta.dirname, "..", archivo), "utf8");

describe("codigoDeError", () => {
  it("muestra el digest de Next (el que aparece en los registros del servidor)", () => {
    expect(codigoDeError(Object.assign(new Error("detalle interno"), { digest: "123abc" }))).toBe("123abc");
  });

  it("sin digest, o con algo que no es un error, no hay código", () => {
    expect(codigoDeError(new Error("x"))).toBeNull();
    expect(codigoDeError("texto")).toBeNull();
    expect(codigoDeError(null)).toBeNull();
    expect(codigoDeError({ digest: "" })).toBeNull();
    expect(codigoDeError({ digest: 5 })).toBeNull();
  });
});

describe("archivos de error de la app", () => {
  it("existen error.tsx, global-error.tsx y not-found.tsx", () => {
    for (const f of ["app/error.tsx", "app/global-error.tsx", "app/not-found.tsx"]) {
      expect(existsSync(path.resolve(import.meta.dirname, "..", f))).toBe(true);
    }
  });

  it("los de error son de cliente, reintentan con retry() y nunca muestran el mensaje del error", () => {
    for (const f of ["app/error.tsx", "app/global-error.tsx"]) {
      const fuente = leer(f);
      expect(fuente.startsWith('"use client";')).toBe(true);
      expect(fuente).toContain("onClick={() => retry()}");
      expect(fuente).not.toMatch(/error\.message|error\.stack|String\(error\)/);
    }
  });

  it("global-error trae su propio documento con el idioma guardado (no tiene LanguageProvider)", () => {
    const fuente = leer("app/global-error.tsx");
    expect(fuente).toContain("const idioma = useIdiomaActual();");
    expect(fuente).toContain("<html lang={idioma}>");
    expect(fuente).toContain("TEXTO_ERROR[idioma]");
    expect(fuente).not.toContain("language-context");
  });

  it("error.tsx usa el idioma de LanguageProvider", () => {
    expect(leer("app/error.tsx")).toContain("TEXTO_ERROR[useLanguage().language]");
  });

  it("ningún texto fijo: todo sale de TEXTO_ERROR del idioma elegido", () => {
    for (const f of ["app/error.tsx", "app/global-error.tsx"]) {
      const fuente = leer(f);
      expect(fuente).not.toMatch(/TEXTO_ERROR\.|Código:|Algo salió mal/);
    }
  });
});

describe("TEXTO_ERROR", () => {
  it("español e inglés tienen las mismas claves, sin textos vacíos", () => {
    expect(Object.keys(TEXTO_ERROR.en).sort()).toEqual(Object.keys(TEXTO_ERROR.es).sort());
    for (const idioma of ["es", "en"] as const) {
      for (const valor of Object.values(TEXTO_ERROR[idioma])) expect(valor.trim()).not.toBe("");
    }
  });

  it("el inglés está traducido (no repite el español)", () => {
    for (const clave of Object.keys(TEXTO_ERROR.es) as (keyof (typeof TEXTO_ERROR)["es"])[]) {
      expect(TEXTO_ERROR.en[clave]).not.toBe(TEXTO_ERROR.es[clave]);
    }
  });
});
