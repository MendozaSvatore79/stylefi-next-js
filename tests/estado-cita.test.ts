/** Nombres y colores de los estados de cita, iguales en todas las pantallas. */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { colorEstado, ESTADOS_CITA, etiquetaEstado } from "@/lib/estado-cita";

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
