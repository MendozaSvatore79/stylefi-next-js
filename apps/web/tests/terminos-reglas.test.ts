/** Los términos dicen las reglas reales de la app (no «según el negocio»). */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { fechaLarga } from "@/components/legal-page-layout";

const terminos = readFileSync(path.resolve(import.meta.dirname, "../app/terms-of-service/page.tsx"), "utf8");

describe("términos: reservas y cancelaciones", () => {
  it("la cita se confirma al reservar, con correo y recordatorio", () => {
    expect(terminos).toContain("la cita queda confirmada de inmediato");
    expect(terminos).toContain("recordatorio un día antes");
    expect(terminos).not.toContain("disponibilidad confirmada por el negocio");
  });

  it("cancelar o cambiar hasta 2 horas antes (la regla de la app, PLAZO_CLIENTE_MIN)", () => {
    expect(terminos).toContain("hasta 2 horas antes");
    expect(terminos).not.toContain("pueden variar según el negocio");
  });

  it("reembolso completo al monedero y horario del centro de México", () => {
    expect(terminos).toContain("te devolvemos el importe completo al monedero");
    expect(terminos).toContain("hora del centro de México");
  });

  it("la fecha de actualización es la de esta versión", () => {
    expect(terminos).toContain('actualizado="2026-11-20"');
    expect(fechaLarga("2026-11-20")).toBe("20 de noviembre de 2026");
    expect(fechaLarga("2026-11-18")).toBe("18 de noviembre de 2026");
  });
});
