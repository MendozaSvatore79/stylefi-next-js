/** Pantallas de error y 404 en español (no hay pruebas de componentes: función pura más guardia sobre el código). */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { codigoDeError } from "@/lib/pagina-error";

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

  it("global-error trae su propio documento en español", () => {
    expect(leer("app/global-error.tsx")).toContain('<html lang="es">');
  });
});
