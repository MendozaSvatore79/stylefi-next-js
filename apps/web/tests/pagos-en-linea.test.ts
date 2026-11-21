/** Aviso de pagos en línea mientras Stripe no esté activo (no hay pruebas de componentes: función + guardia). */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { AVISO_PAGOS, pagosEnLineaDe } from "@/lib/pagos-en-linea";

describe("pagosEnLineaDe", () => {
  it("el backend dice que no: sin pagos en línea", () => {
    expect(pagosEnLineaDe({ pagosEnLinea: false })).toBe(false);
  });

  it("el backend dice que sí, o es uno anterior sin el campo: como antes", () => {
    expect(pagosEnLineaDe({ pagosEnLinea: true })).toBe(true);
    expect(pagosEnLineaDe({})).toBe(true);
  });

  it("el aviso dice que se paga en el salón, en los dos idiomas", () => {
    expect(AVISO_PAGOS.es).toBe("Los pagos en línea llegarán pronto. Por ahora pagas en el salón.");
    expect(AVISO_PAGOS.en).toContain("pay at the salon");
  });
});

describe("pantalla de Pagos", () => {
  const fuente = readFileSync(path.resolve(import.meta.dirname, "../app/(con-sesion)/dashboard/cliente/pagos/page.tsx"), "utf8");

  it("toma pagosEnLinea de la respuesta y, sin él, cambia el formulario de tarjeta a efectivo", () => {
    expect(fuente).toContain("const enLinea = pagosEnLineaDe(payload);");
    expect(fuente).toContain('current.provider === "card" ? { ...current, provider: "cash" } : current');
  });

  it("la opción y el formulario de tarjeta solo aparecen con pagos en línea", () => {
    expect(fuente).toContain('{pagosEnLinea ? <option value="card">');
    expect(fuente).toContain('{form.provider === "card" && pagosEnLinea ? (');
  });

  it("la recarga solo aparece con pagos en línea; sin ellos, el aviso", () => {
    const recarga = fuente.indexOf("onSubmit={handleRecharge}");
    const bloque = fuente.lastIndexOf("{pagosEnLinea ? (", recarga);
    expect(bloque).toBeGreaterThan(-1);
    expect(fuente.slice(bloque, recarga)).not.toContain(") : null}");
    expect(fuente.match(/pagosEnLinea === false \? \(/g)).toHaveLength(2);
    expect(fuente).toContain("{language === \"en\" ? AVISO_PAGOS.en : AVISO_PAGOS.es}");
  });

  it("mientras carga (null) no se ofrece ni recarga ni tarjeta", () => {
    expect(fuente).toContain("useState<boolean | null>(null)");
  });
});
