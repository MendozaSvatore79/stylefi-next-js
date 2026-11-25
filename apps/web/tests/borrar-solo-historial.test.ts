import { readFileSync } from "node:fs";
import path from "node:path";

import { esDelHistorial } from "@stylefi/shared";
import { describe, expect, it } from "vitest";

const citas = readFileSync(path.resolve(import.meta.dirname, "..", "app/(con-sesion)/dashboard/cliente/citas/page.tsx"), "utf8");
const ahora = new Date("2026-11-25T12:00:00Z");

describe("esDelHistorial: qué puede borrar el cliente (misma regla que el servidor)", () => {
  it("completadas y canceladas, aunque sean futuras", () => {
    expect(esDelHistorial({ status: "completed", scheduled_at: "2026-11-20T10:00:00Z" }, ahora)).toBe(true);
    expect(esDelHistorial({ status: "cancelled", scheduled_at: "2026-12-01T10:00:00Z" }, ahora)).toBe(true);
  });

  it("cualquier cita que ya pasó, aunque nadie la haya cerrado", () => {
    expect(esDelHistorial({ status: "confirmed", scheduled_at: "2026-11-24T10:00:00Z" }, ahora)).toBe(true);
    expect(esDelHistorial({ status: "no_show", scheduled_at: "2026-11-24T10:00:00Z" }, ahora)).toBe(true);
  });

  it("una cita futura pendiente o confirmada NO es del historial", () => {
    expect(esDelHistorial({ status: "confirmed", scheduled_at: "2026-11-28T10:00:00Z" }, ahora)).toBe(false);
    expect(esDelHistorial({ status: "pending", scheduled_at: new Date("2026-11-25T12:00:01Z") }, ahora)).toBe(false);
  });
});

describe("Mis citas: borrar nunca alcanza a las citas futuras", () => {
  it("ya no existe «Borrar todas las citas» ni se pide clearMode all", () => {
    expect(citas).not.toMatch(/Borrar todas las citas|Delete all appointments/);
    expect(citas).not.toContain('clearMode: "all"');
    expect(citas).not.toContain("handleDeleteAllAppointments");
  });

  it("«Limpiar solo historial pasado» sigue y pide clearMode past", () => {
    expect(citas).toContain('clearMode: "past"');
    expect(citas).toContain("Limpiar solo historial pasado");
  });

  it("«Borrar del historial» solo aparece en citas del historial", () => {
    expect(citas).toMatch(/\{esDelHistorial\(appointment\) \? \(\s*<button[\s\S]{0,200}handleDeleteAppointment\(appointment\.id\)/);
  });
});
