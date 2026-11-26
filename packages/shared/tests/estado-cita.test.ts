/** Estados de cita: nombres, colores, plazo del cliente y formato de hora (reglas puras). */
import { describe, expect, it } from "vitest";

import {
  cierrePendiente,
  colorEstado,
  DIAS_PARA_SIN_CONFIRMAR,
  ESTADOS_CITA,
  etiquetaDeCita,
  etiquetaEstado,
  fechaHoraCita,
  PLAZO_CLIENTE_MIN,
  puedeModificarCliente,
} from "../src/estado-cita.js";

describe("etiquetaEstado", () => {
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

describe("puedeModificarCliente", () => {
  const AHORA = new Date("2026-11-14T16:00:00Z");
  const en = (min: number) => new Date(AHORA.getTime() + min * 60_000).toISOString();

  it("el plazo es de 2 horas", () => {
    expect(PLAZO_CLIENTE_MIN).toBe(120);
  });

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
});

describe("cierrePendiente", () => {
  const ahora = new Date("2026-11-25T18:00:00Z");
  const hace = (ms: number) => new Date(ahora.getTime() - ms).toISOString();
  const DIA = 24 * 60 * 60_000;

  it("son 7 días", () => {
    expect(DIAS_PARA_SIN_CONFIRMAR).toBe(7);
  });

  it("antes de su hora no hay nada que cerrar; justo a su hora ya está por cerrar", () => {
    expect(cierrePendiente({ status: "confirmed", scheduled_at: hace(-60_000) }, ahora)).toBeNull();
    expect(cierrePendiente({ status: "confirmed", scheduled_at: hace(0) }, ahora)).toBe("por-cerrar");
  });

  it("por cerrar hasta 7 días exactos; un minuto después, sin confirmar", () => {
    expect(cierrePendiente({ status: "pending", scheduled_at: hace(7 * DIA) }, ahora)).toBe("por-cerrar");
    expect(cierrePendiente({ status: "pending", scheduled_at: hace(7 * DIA + 60_000) }, ahora)).toBe("sin-confirmar");
    expect(cierrePendiente({ status: "confirmed", scheduled_at: hace(40 * DIA) }, ahora)).toBe("sin-confirmar");
  });

  it("las cerradas o canceladas nunca quedan pendientes de cierre", () => {
    for (const status of ["completed", "no_show", "cancelled"]) {
      expect(cierrePendiente({ status, scheduled_at: hace(30 * DIA) }, ahora)).toBeNull();
    }
  });

  it("la etiqueta dice «Pasada sin confirmar» solo después de los 7 días", () => {
    expect(etiquetaDeCita({ status: "confirmed", scheduled_at: hace(8 * DIA) }, "es", ahora)).toBe("Pasada sin confirmar");
    expect(etiquetaDeCita({ status: "confirmed", scheduled_at: hace(8 * DIA) }, "en", ahora)).toBe("Past, unconfirmed");
    expect(etiquetaDeCita({ status: "confirmed", scheduled_at: hace(DIA) }, "es", ahora)).toBe("Confirmada");
    expect(etiquetaDeCita({ status: "completed", scheduled_at: hace(8 * DIA) }, "es", ahora)).toBe("Completada");
  });
});
