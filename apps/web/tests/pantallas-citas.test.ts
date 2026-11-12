/**
 * Guardia sobre el código de las pantallas de citas (no hay pruebas de componentes en el proyecto).
 * Lo de verdad se verifica en el navegador; esto evita que vuelvan cosas que el servidor ya rechaza.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const leer = (archivo: string) => readFileSync(path.resolve(import.meta.dirname, "..", archivo), "utf8");
const PANTALLAS = ["components/salon-modal.tsx", "app/dashboard/cliente/citas/page.tsx"];

describe("pantallas de citas", () => {
  it.each(PANTALLAS)("%s no manda precio, nombre del servicio ni la opción tarjeta", (archivo) => {
    const fuente = leer(archivo);
    // Cuerpos que se envían al reservar o reagendar (los que llevan scheduledAt)
    const cuerpos = [...fuente.matchAll(/JSON\.stringify\(\{([\s\S]*?)\}\)/g)].map((m) => m[1]).filter((c) => c.includes("scheduledAt"));
    expect(cuerpos.length).toBeGreaterThan(0);
    for (const cuerpo of cuerpos) {
      expect(cuerpo).not.toContain("totalAmount");
      expect(cuerpo).not.toContain("serviceName");
      expect(cuerpo).not.toContain("...form");
    }
    expect(fuente).not.toContain('paymentProvider: "card"');
  });

  it.each(PANTALLAS)("%s pasa el estilista elegido al selector de horarios y a la reserva", (archivo) => {
    const fuente = leer(archivo);
    expect(fuente).toMatch(/stylistId=\{[^}]*stylistId/);
    expect(fuente).toMatch(/stylistId: (bookingForm|form)\.stylistId/);
  });

  it("al reagendar se usa el selector de horarios, no una fecha libre", () => {
    const fuente = leer("app/dashboard/cliente/citas/page.tsx");
    expect(fuente).not.toContain('type="datetime-local"');
    expect(fuente).toContain("onSelectTime={(iso) => setEditScheduledAt(iso)}");
  });

  it("el selector de horarios manda sucursal y estilista a la API", () => {
    const fuente = leer("components/time-slot-picker.tsx");
    expect(fuente).toContain('params.set("branchId", branchId)');
    expect(fuente).toContain('params.set("stylistId", stylistId)');
  });
});

describe("pantalla de citas del negocio", () => {
  const fuente = leer("app/dashboard/negocio/citas/page.tsx");

  it("solo ofrece los cambios de estado que el servidor permite, incluido «no asistió»", () => {
    expect(fuente).toContain("function estadosPermitidos");
    expect(fuente).toContain("etiquetaEstado(status, language)"); // nombres en lib/estado-cita.ts (incluye «No asistió»)
    expect(fuente).not.toContain("const STATUSES");
  });

  it("muestra la hora en la zona del negocio", () => {
    expect(fuente).toContain("fechaHoraCita(appointment.scheduled_at, language)"); // zona del negocio, en lib/estado-cita.ts
  });
});
