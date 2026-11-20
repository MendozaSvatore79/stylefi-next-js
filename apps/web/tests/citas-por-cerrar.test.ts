/** Aviso de citas por cerrar en la agenda del negocio. */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { avisoCitasPorCerrar, citasPorCerrar, esPorCerrar } from "@/lib/citas-por-cerrar";

const AHORA = Date.parse("2031-03-10T15:00:00Z");
const cita = (status: string, horas: number) => ({
  status,
  scheduled_at: new Date(AHORA + horas * 3_600_000).toISOString(),
});

describe("esPorCerrar", () => {
  it("pendiente o confirmada cuya hora ya llegó: por cerrar", () => {
    expect(esPorCerrar(cita("pending", -1), AHORA)).toBe(true);
    expect(esPorCerrar(cita("confirmed", -48), AHORA)).toBe(true);
    expect(esPorCerrar(cita("confirmed", 0), AHORA)).toBe(true);
  });

  it("futura, o ya cerrada (completada, cancelada, no asistió): no", () => {
    expect(esPorCerrar(cita("confirmed", 1), AHORA)).toBe(false);
    for (const s of ["completed", "cancelled", "no_show"]) expect(esPorCerrar(cita(s, -5), AHORA)).toBe(false);
  });
});

describe("citasPorCerrar y el aviso", () => {
  it("cuenta solo las abiertas que ya pasaron", () => {
    const lista = [cita("pending", -2), cita("confirmed", -1), cita("confirmed", 3), cita("completed", -1)];
    expect(citasPorCerrar(lista, AHORA)).toHaveLength(2);
  });

  it("sin citas por cerrar no hay aviso; en singular y plural, en los dos idiomas", () => {
    expect(avisoCitasPorCerrar(0, "es")).toBeNull();
    expect(avisoCitasPorCerrar(1, "es")).toBe("Tienes 1 cita que ya pasó y sigue abierta. Márcala como completada o no asistió.");
    expect(avisoCitasPorCerrar(3, "es")).toContain("Tienes 3 citas que ya pasaron");
    expect(avisoCitasPorCerrar(2, "en")).toContain("You have 2 past appointments");
  });
});

describe("agenda del negocio", () => {
  const fuente = readFileSync(path.resolve(import.meta.dirname, "../app/dashboard/negocio/citas/page.tsx"), "utf8");

  it("muestra el aviso con el conteo y resalta cada cita por cerrar", () => {
    expect(fuente).toContain("avisoCitasPorCerrar(citasPorCerrar(appointments).length");
    expect(fuente).toMatch(/\{aviso \? \(\s*<p role="status" data-citas-por-cerrar/);
    expect(fuente).toContain("esPorCerrar(appointment) ?");
  });
});
