import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const RAIZ = path.resolve(import.meta.dirname, "..");
const leer = (archivo: string) => readFileSync(path.join(RAIZ, archivo), "utf8");
const todos = (dir: string): string[] =>
  readdirSync(path.join(RAIZ, dir)).flatMap((n) => {
    const r = path.join(dir, n);
    return statSync(path.join(RAIZ, r)).isDirectory() ? todos(r) : /\.tsx$/.test(n) ? [r] : [];
  });

describe("contraste de texto (WCAG AA), medido en local el 2026-11-25", () => {
  it("ningún texto blanco sobre emerald-600 (3.67:1): los botones verdes usan emerald-700", () => {
    const malos = [...todos("app"), ...todos("components")].filter((f) => /bg-emerald-600[^"`]*text-white|text-white[^"`]*bg-emerald-600/.test(leer(f)));
    expect(malos).toEqual([]);
  });

  it("el encabezado del modal del salón sin foto es oscuro (los textos son blancos)", () => {
    const modal = leer("components/salon-modal.tsx");
    expect(modal).toContain('<div className="relative h-56 bg-linear-to-br from-indigo-700 via-indigo-600 to-purple-700">');
    expect(modal).not.toContain("from-indigo-100 via-indigo-50 to-purple-100");
  });

  it("en las tarjetas de Salones, «Verificado» y el corazón van sobre fondo oscuro", () => {
    const salones = leer("app/(con-sesion)/dashboard/cliente/salones/page.tsx");
    expect(salones).not.toContain("bg-black/20");
    expect(salones.match(/bg-black\/55/g)).toHaveLength(2);
  });

  it("textos que estaban por debajo de 4.5:1", () => {
    expect(leer("app/page.tsx")).toContain('text-red-600">Comienza ahora');
    const config = leer("app/(con-sesion)/dashboard/negocio/configuracion/page.tsx");
    expect(config).not.toMatch(/activeSection === "\w+" \? "text-emerald-600"/);
    expect(config.match(/activeSection === "\w+" \? "text-emerald-800" : "text-slate-600"/g)).toHaveLength(3);
  });
});
