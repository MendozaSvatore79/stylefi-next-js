import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const leer = (archivo: string) => readFileSync(path.resolve(import.meta.dirname, "..", archivo), "utf8");

/** El código sin comentarios ni las tablas de textos { es, en }: lo que queda es lo que se pinta tal cual. */
function sinTablasNiComentarios(fuente: string): string {
  return fuente
    .replace(/const TEXTOS_[A-Z_]+ = \{[\s\S]*?\n\} as const;/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const modal = leer("components/salon-modal.tsx");
const horarios = leer("components/time-slot-picker.tsx");

describe("textos del cliente en español e inglés (3a)", () => {
  it.each([
    ["modal de reserva", modal, ["Acceso restringido", "Inicia sesión para ver más detalles", "años de experiencia", "Dirección:", "Flujo de reserva", "Paso 1 de 2", "Paso 2 de 2", "Último paso para confirmar", "Saldo wallet", "Selecciona un horario disponible", "La ubicación no está disponible", ">\\s*Cerrar\\s*<", ">\\s*Iniciar sesión\\s*<"]],
    ["selector de horarios", horarios, ["Selecciona negocio, servicio y fecha", "Cargando horarios", "No hay horarios disponibles", "Horarios disponibles", "min cada uno", 'title="Ocupado"']],
  ])("%s: no quedan textos fijos en español", (_nombre, fuente, frases) => {
    const codigo = sinTablasNiComentarios(fuente);
    for (const frase of frases) expect(codigo).not.toMatch(new RegExp(frase));
  });

  it("las tablas de textos tienen español e inglés en cada entrada", () => {
    for (const fuente of [modal, horarios]) {
      const tabla = fuente.match(/const TEXTOS_[A-Z_]+ = \{([\s\S]*?)\n\} as const;/)?.[1] ?? "";
      const entradas = [...tabla.matchAll(/^\s+(\w+): \{/gm)].length;
      expect(entradas).toBeGreaterThan(4);
      expect([...tabla.matchAll(/\bes: "/g)].length).toBe(entradas);
      expect([...tabla.matchAll(/\ben: "/g)].length).toBe(entradas);
    }
  });

  it("el selector de horarios lee el idioma", () => {
    expect(horarios).toContain("const { language } = useLanguage();");
  });

  it("el aviso de ubicación no disponible sale una sola vez (traducido)", () => {
    expect(modal.match(/modal\.locationUnavailable/g)).toHaveLength(1);
  });
});
