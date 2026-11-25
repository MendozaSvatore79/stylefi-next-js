import { readFileSync } from "node:fs";
import path from "node:path";

import { fechaLocal } from "@stylefi/shared";
import { describe, expect, it } from "vitest";

const leer = (archivo: string) => readFileSync(path.resolve(import.meta.dirname, "..", archivo), "utf8");
const citas = leer("app/(con-sesion)/dashboard/cliente/citas/page.tsx");
const modal = leer("components/salon-modal.tsx");

describe("fecha mínima de los calendarios del cliente", () => {
  it("a las 20:00 de México ya es «mañana» en UTC: el mínimo debe ser hoy en México", () => {
    const veinteHoras = new Date("2026-11-25T02:00:00Z"); // 24 nov, 20:00 en México
    expect(veinteHoras.toISOString().split("T")[0]).toBe("2026-11-25");
    expect(fechaLocal(veinteHoras)).toBe("2026-11-24");
  });

  it("ningún calendario de reserva calcula el mínimo en UTC", () => {
    for (const fuente of [citas, modal]) {
      expect(fuente).not.toMatch(/min=\{new Date\(\)\.toISOString\(\)/);
    }
    expect(citas.match(/min=\{fechaLocal\(new Date\(\)\)\}/g)).toHaveLength(2);
    expect(modal).toContain("min={fechaLocal(new Date())}");
  });

  it("Reagendar: la fecha tiene etiqueta visible (Campo), no solo aria-label", () => {
    expect(citas).toMatch(/<Campo etiqueta=\{language === "en" \? "New date" : "Nueva fecha"\}>\s*<input\s+type="date"\s+value=\{editDate\}/);
  });
});
