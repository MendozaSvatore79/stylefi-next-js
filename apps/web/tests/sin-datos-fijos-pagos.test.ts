import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const leer = (archivo: string) => readFileSync(path.resolve(import.meta.dirname, "..", archivo), "utf8");
const panelCliente = leer("app/(con-sesion)/dashboard/cliente/page.tsx");
const idioma = leer("lib/language-context.tsx");
const valor = (clave: string, bloque: "es" | "en") => {
  const inicio = idioma.indexOf(`  ${bloque}: {`);
  const fin = idioma.indexOf("\n  },", inicio);
  return idioma.slice(inicio, fin).match(new RegExp(`"${clave.replace(/\./g, "\\.")}": "([^"]*)"`))?.[1] ?? "";
};

describe("nada que prometa pagar con tarjeta mientras los pagos en línea están apagados", () => {
  it("el resumen del cliente lee pagosEnLinea del backend", () => {
    expect(panelCliente).toContain("setPagosEnLinea(pagosEnLineaDe(payload));");
  });

  it("las tarjetas de método de pago y el contador de métodos solo salen con pagos en línea", () => {
    expect(panelCliente).toMatch(/\{pagosEnLinea \? \(\s*<StatCard title=\{t\("dashboard\.client\.methods"\)\}/);
    expect(panelCliente).toMatch(/\{pagosEnLinea \? \(\s*<>[\s\S]*dashboard\.client\.activeMethod[\s\S]*dashboard\.client\.savedMethods[\s\S]*<\/>\s*\) : null\}/);
  });

  it("con pagos apagados se muestra el aviso de pago en el salón", () => {
    expect(panelCliente).toMatch(/\{pagosEnLinea === false \? \([\s\S]{0,300}AVISO_PAGOS\[/);
  });

  it.each(["tip.client.body", "dashboard.client.step2", "onboarding.client.step3.title", "onboarding.client.step3.desc", "onboarding.client.step4.desc"])(
    "%s no habla de tarjetas, Stripe ni métodos guardados (ES y EN)",
    (clave) => {
      for (const bloque of ["es", "en"] as const) {
        const texto = valor(clave, bloque);
        expect(texto.length).toBeGreaterThan(5);
        expect(texto).not.toMatch(/tarjeta|Stripe|\bcard\b|método|method|wallet/i);
      }
    },
  );
});
