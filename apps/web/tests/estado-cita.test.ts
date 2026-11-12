/** Nombres y colores de los estados de cita, iguales en todas las pantallas. */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { colorEstado, ESTADOS_CITA, etiquetaEstado, fechaHoraCita, PLAZO_CLIENTE_MIN, puedeModificarCliente } from "@/lib/estado-cita";

const leer = (archivo: string) => readFileSync(path.resolve(import.meta.dirname, "..", archivo), "utf8");

describe("etiquetaEstado", () => {
  it("cubre exactamente los estados que acepta la base", () => {
    // La restricción vigente de stylehub_client_appointments es la que incluye 'no_show'.
    const check = leer("lib/db-init.ts").match(/CHECK \(status IN \(('pending'[^)]*'no_show'[^)]*)\)\)/)?.[1];
    const enLaBase = [...(check ?? "").matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(enLaBase.length).toBeGreaterThan(0);
    expect([...ESTADOS_CITA].sort()).toEqual(enLaBase);
  });

  it("traduce cada estado en español e inglés", () => {
    expect(ESTADOS_CITA.map((s) => etiquetaEstado(s, "es"))).toEqual(["Pendiente", "Confirmada", "Completada", "No asistió", "Cancelada"]);
    expect(ESTADOS_CITA.map((s) => etiquetaEstado(s, "en"))).toEqual(["Pending", "Confirmed", "Completed", "No-show", "Cancelled"]);
    for (const s of ESTADOS_CITA) expect(etiquetaEstado(s, "es")).not.toBe(s);
  });

  it("un estado desconocido se muestra tal cual", () => {
    expect(etiquetaEstado("otro", "es")).toBe("otro");
  });
});

describe("colorEstado", () => {
  it("verde confirmada, ámbar pendiente, gris el resto", () => {
    expect(colorEstado("confirmed")).toContain("emerald");
    expect(colorEstado("pending")).toContain("amber");
    for (const s of ["completed", "no_show", "cancelled", "otro"]) expect(colorEstado(s)).toContain("slate");
  });
});

describe("pantallas", () => {
  it.each(["app/dashboard/cliente/citas/page.tsx", "app/dashboard/cliente/page.tsx", "app/dashboard/negocio/citas/page.tsx"])(
    "%s no muestra el estado sin traducir",
    (archivo) => {
      const fuente = leer(archivo);
      expect(fuente).not.toMatch(/>\s*\{appointment\.status\}\s*</);
      expect(fuente).toContain("etiquetaEstado(");
    },
  );
});

describe("puedeModificarCliente", () => {
  const AHORA = new Date("2026-11-14T16:00:00Z");
  const en = (min: number) => new Date(AHORA.getTime() + min * 60_000).toISOString();

  it("pendiente o confirmada con más de 2 horas: permitido", () => {
    expect(puedeModificarCliente({ status: "confirmed", scheduled_at: en(121) }, AHORA)).toBe("permitido");
    expect(puedeModificarCliente({ status: "pending", scheduled_at: en(60 * 24) }, AHORA)).toBe("permitido");
  });

  it("justo a 2 horas, menos, o ya pasada: fuera de plazo (igual que el servidor)", () => {
    expect(puedeModificarCliente({ status: "confirmed", scheduled_at: en(120) }, AHORA)).toBe("fuera-de-plazo");
    expect(puedeModificarCliente({ status: "confirmed", scheduled_at: en(30) }, AHORA)).toBe("fuera-de-plazo");
    expect(puedeModificarCliente({ status: "pending", scheduled_at: en(-60) }, AHORA)).toBe("fuera-de-plazo");
  });

  it.each(["cancelled", "completed", "no_show"])("%s: cerrada, aunque falte mucho", (status) => {
    expect(puedeModificarCliente({ status, scheduled_at: en(60 * 24) }, AHORA)).toBe("cerrada");
  });

  it("el servidor usa el mismo plazo", async () => {
    const booking = await import("@/lib/booking");
    expect(booking.PLAZO_CLIENTE_MIN).toBe(PLAZO_CLIENTE_MIN);
    expect(PLAZO_CLIENTE_MIN).toBe(120);
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

describe("fechaHoraCita", () => {
  it("usa la hora de México y formato corto, sin segundos", () => {
    const fecha = "2026-11-14T16:00:00Z"; // 10:00 en Ciudad de México
    const es = fechaHoraCita(fecha, "es");
    expect(es).toMatch(/14 nov 2026/);
    expect(es).toMatch(/10:00/);
    expect(es).not.toMatch(/10:00:00/);
    expect(fechaHoraCita(fecha, "en")).toMatch(/Nov 14, 2026.*10:00/);
  });

  it.each(["app/dashboard/cliente/citas/page.tsx", "app/dashboard/cliente/page.tsx", "app/dashboard/negocio/citas/page.tsx"])(
    "%s muestra la hora de la cita con fechaHoraCita",
    (archivo) => {
      const fuente = leer(archivo);
      expect(fuente).toContain("fechaHoraCita(appointment.scheduled_at, language)");
      expect(fuente).not.toMatch(/new Date\(appointment\.scheduled_at\)\.toLocale/);
    },
  );
});
