/** Las pantallas usan los estados de cita de @stylefi/shared (la base y el servidor se comprueban en el backend). */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const leer = (archivo: string) => readFileSync(path.resolve(import.meta.dirname, "..", archivo), "utf8");
const PANTALLAS = ["app/dashboard/cliente/citas/page.tsx", "app/dashboard/cliente/page.tsx", "app/dashboard/negocio/citas/page.tsx"];

describe("pantallas", () => {
  it.each(PANTALLAS)("%s no muestra el estado sin traducir", (archivo) => {
    const fuente = leer(archivo);
    expect(fuente).not.toMatch(/>\s*\{appointment\.status\}\s*</);
    expect(fuente).toContain("etiquetaEstado(");
  });

  it.each(PANTALLAS)("%s muestra la hora de la cita con fechaHoraCita", (archivo) => {
    const fuente = leer(archivo);
    expect(fuente).toContain("fechaHoraCita(appointment.scheduled_at, language)");
    expect(fuente).not.toMatch(/new Date\(appointment\.scheduled_at\)\.toLocale/);
  });

  it("Mis citas solo muestra Reagendar y Cancelar cuando está permitido", () => {
    const fuente = leer("app/dashboard/cliente/citas/page.tsx");
    const guardia = fuente.indexOf('puedeModificarCliente(appointment) === "permitido"');
    expect(guardia).toBeGreaterThan(0);
    expect(fuente.indexOf("openReschedule(appointment)")).toBeGreaterThan(guardia);
    expect(fuente.indexOf("handleCancelAppointment(appointment.id)")).toBeGreaterThan(guardia);
    expect(fuente).toContain("Faltan menos de 2 horas: para cambiarla, comunícate con el negocio.");
  });
});
