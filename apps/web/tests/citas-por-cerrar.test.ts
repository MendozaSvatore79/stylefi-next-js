/** Aviso de citas por cerrar en la agenda del negocio. */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { avisoCitasPorCerrar, citasPorCerrar, esPorCerrar, esSinConfirmar } from "@/lib/citas-por-cerrar";

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

  it("hasta 7 días por cerrar; después, «sin confirmar» (y ya no por cerrar)", () => {
    expect(esPorCerrar(cita("confirmed", -24 * 7), AHORA)).toBe(true);
    expect(esSinConfirmar(cita("confirmed", -24 * 7), AHORA)).toBe(false);
    expect(esPorCerrar(cita("pending", -24 * 7 - 1), AHORA)).toBe(false);
    expect(esSinConfirmar(cita("pending", -24 * 7 - 1), AHORA)).toBe(true);
    expect(esSinConfirmar(cita("completed", -24 * 30), AHORA)).toBe(false);
  });

  it("futura, o ya cerrada (completada, cancelada, no asistió): no", () => {
    expect(esPorCerrar(cita("confirmed", 1), AHORA)).toBe(false);
    for (const s of ["completed", "cancelled", "no_show"]) expect(esPorCerrar(cita(s, -5), AHORA)).toBe(false);
  });
});

describe("citasPorCerrar y el aviso", () => {
  it("cuenta solo las abiertas que ya pasaron, de los últimos 7 días", () => {
    const lista = [cita("pending", -2), cita("confirmed", -1), cita("confirmed", 3), cita("completed", -1), cita("confirmed", -24 * 10)];
    expect(citasPorCerrar(lista, AHORA)).toHaveLength(2);
  });

  it("sin citas por cerrar no hay aviso; en singular y plural, en los dos idiomas", () => {
    expect(avisoCitasPorCerrar(0, "es")).toBeNull();
    expect(avisoCitasPorCerrar(1, "es")).toBe("Tienes 1 cita que ya pasó y sigue abierta. Márcala como completada o no asistió.");
    expect(avisoCitasPorCerrar(3, "es")).toContain("Tienes 3 citas que ya pasaron");
    expect(avisoCitasPorCerrar(2, "en")).toContain("You have 2 past appointments");
  });
});

const leer = (ruta: string) => readFileSync(path.resolve(import.meta.dirname, "..", ruta), "utf8");

describe("agenda del negocio", () => {
  const fuente = leer("app/(con-sesion)/dashboard/negocio/citas/page.tsx");

  it("arriba, la sección «Citas por cerrar (N)» con el aviso; abajo, las demás", () => {
    expect(fuente).toContain("const porCerrar = citasPorCerrar(appointments);");
    expect(fuente).toContain("const demas = appointments.filter((a) => !esPorCerrar(a));");
    expect(fuente).toMatch(/\{porCerrar\.length > 0 \? \(\s*<article data-seccion-por-cerrar/);
    expect(fuente).toContain('{language === "en" ? "Appointments to close" : "Citas por cerrar"} ({porCerrar.length})');
    expect(fuente).toContain("avisoCitasPorCerrar(porCerrar.length");
    expect(fuente).toContain("{porCerrar.map(tarjeta)}");
    expect(fuente).toContain("{demas.map(tarjeta)}");
  });

  it("las que ya pasaron y siguen abiertas se cierran de un clic: Completada o No asistió", () => {
    expect(fuente).toMatch(/\{porCerrar \|\| sinConfirmar \? \(/);
    expect(fuente).toContain('onClick={() => void updateStatus(appointment.id, "completed")}');
    expect(fuente).toContain('onClick={() => void updateStatus(appointment.id, "no_show")}');
  });

  it("las de más de 7 días llevan la etiqueta «Pasada sin confirmar»", () => {
    expect(fuente).toContain("const sinConfirmar = esSinConfirmar(appointment);");
    expect(fuente).toMatch(/\{sinConfirmar \? \(\s*<span data-sin-confirmar[^>]*>\s*\{etiquetaDeCita\(appointment, language\)\}/);
  });
});

describe("inicio del panel del negocio", () => {
  const fuente = leer("app/(con-sesion)/dashboard/negocio/page.tsx");
  it("avisa cuántas citas hay por cerrar, con enlace a Citas", () => {
    expect(fuente).toContain("avisoCitasPorCerrar(summary.citasPorCerrar ?? 0");
    expect(fuente).toMatch(/\{avisoPorCerrar \? \(\s*<div role="status" data-aviso-por-cerrar[\s\S]*?href="\/dashboard\/negocio\/citas"/);
  });
});

describe("citas del admin", () => {
  const fuente = leer("app/(con-sesion)/dashboard/admin/citas/page.tsx");
  it("cuenta y filtra «por cerrar» y «sin confirmar», y la lista muestra «Pasada sin confirmar»", () => {
    expect(fuente).toContain('const ESTADOS_ADMIN = [...ESTADOS_CITA, "por_cerrar", "sin_confirmar"] as const;');
    expect(fuente.match(/\{ESTADOS_ADMIN\.map\(\(e\) =>/g)).toHaveLength(2);
    expect(fuente).not.toContain("{ESTADOS_CITA.map(");
    expect(fuente).toContain("etiquetaDeCita(cita, language)");
  });
});
