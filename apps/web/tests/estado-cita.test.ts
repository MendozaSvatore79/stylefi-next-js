/** Los estados de cita (de @stylefi/shared) cuadran con la base, el servidor y las pantallas. */
import { readFileSync } from "node:fs";
import path from "node:path";

import { ESTADOS_CITA, PLAZO_CLIENTE_MIN } from "@stylefi/shared";
import { describe, expect, it } from "vitest";

const leer = (archivo: string) => readFileSync(path.resolve(import.meta.dirname, "..", archivo), "utf8");
const PANTALLAS = ["app/dashboard/cliente/citas/page.tsx", "app/dashboard/cliente/page.tsx", "app/dashboard/negocio/citas/page.tsx"];

describe("estados de cita", () => {
  it("cubren exactamente los estados que acepta la base", () => {
    // La restricción vigente de stylehub_client_appointments es la que incluye 'no_show'.
    const check = leer("lib/db-init.ts").match(/CHECK \(status IN \(('pending'[^)]*'no_show'[^)]*)\)\)/)?.[1];
    const enLaBase = [...(check ?? "").matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(enLaBase.length).toBeGreaterThan(0);
    expect([...ESTADOS_CITA].sort()).toEqual(enLaBase);
  });

  it("el servidor usa el mismo plazo de 2 horas", async () => {
    const booking = await import("@/lib/booking");
    expect(booking.PLAZO_CLIENTE_MIN).toBe(PLAZO_CLIENTE_MIN);
  });
});

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
