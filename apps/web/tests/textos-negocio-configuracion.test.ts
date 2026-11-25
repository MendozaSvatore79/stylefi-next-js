import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const fuente = readFileSync(path.resolve(import.meta.dirname, "..", "app/(con-sesion)/dashboard/negocio/configuracion/page.tsx"), "utf8");
const tabla = fuente.match(/const T = \{([\s\S]*?)\n\} as const;/)?.[1] ?? "";
const codigo = fuente.replace(/const T = \{[\s\S]*?\n\} as const;/, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("Facturación: «Próximamente», sin datos inventados", () => {
  it("ya no muestra un plan, un precio, una fecha de pago ni un botón de cambiar plan", () => {
    for (const x of ["Plan Premium", "29.99", "Próximo pago", "Next payment", "Cambiar plan", "Change plan", "planActivo", "precioPlan", "proximoPago", "cambiarPlan"]) expect(fuente).not.toContain(x);
  });

  it("muestra «Próximamente» con el texto elegido (sin prometer que no tiene costo)", () => {
    expect(codigo).toContain("{T.proximamente[language]}");
    expect(codigo).toContain("{T.proximamenteDesc[language]}");
    expect(tabla).toContain('proximamenteDesc: { es: "Los planes y la facturación para negocios llegarán pronto."');
    expect(fuente).not.toMatch(/no tiene costo|free of charge|no cost/i);
  });
});

describe("Configuración del negocio en español e inglés (3b)", () => {
  it("lee el idioma y lo usa también en la validación", () => {
    expect(fuente).toContain("const { language } = useLanguage();");
    expect(codigo).toContain("LIMITES.nombreLegal, language)");
    expect(codigo).toContain("errorTelefono(form.phone, language)");
    expect(codigo).not.toMatch(/, "es"\)/);
  });

  it("no quedan textos fijos en español fuera de la tabla", () => {
    for (const frase of ["Ajustes del negocio", "Pagos y planes", "Datos del salón", "Acceso y contraseña", "Sucursal principal", "Editar en Sucursales", "Información de la cuenta", 'placeholder="', "Revisa el formulario", "Perfil actualizado", "No se pudo guardar", "Intenta de nuevo", "Próximamente"]) {
      expect(codigo).not.toContain(frase);
    }
  });

  it("cada texto de la tabla tiene español e inglés", () => {
    const entradas = [...tabla.matchAll(/^\s+(\w+): \{/gm)].length;
    expect(entradas).toBeGreaterThan(25);
    expect([...tabla.matchAll(/\bes: "/g)].length).toBe(entradas);
    expect([...tabla.matchAll(/\ben: "/g)].length).toBe(entradas);
  });
});
