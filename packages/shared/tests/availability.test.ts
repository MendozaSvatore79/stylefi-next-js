/** Cálculo de horarios libres. Fechas fijas: lunes 7 de enero de 2030, hora de Ciudad de México (UTC-6). */
import { describe, expect, it } from "vitest";

import {
  diaDeLaSemana,
  esFecha,
  fechaLocal,
  horaLocal,
  horaLocalAUtc,
  horariosLibres,
  type EstilistaDelDia,
} from "../src/availability.js";

const LUNES = "2030-01-07";
const DOMINGO_PREVIO = new Date("2030-01-06T18:00:00Z"); // "ahora": el día anterior al mediodía
const h = (hora: string, fecha = LUNES) => horaLocalAUtc(fecha, hora);
const ANA: EstilistaDelDia = {
  id: "ana",
  bloques: [
    { dayOfWeek: 0, start: "10:00:00", end: "14:00:00" },
    { dayOfWeek: 0, start: "15:00", end: "19:00" },
  ],
  ocupado: [],
};
const libres = (estilistas: EstilistaDelDia[], duracionMin = 45, ahora = DOMINGO_PREVIO, fecha = LUNES) =>
  horariosLibres({ fecha, duracionMin, estilistas, ahora }).map((x) => horaLocal(x.inicio));

describe("zona horaria", () => {
  it("10:00 en Ciudad de México son las 16:00 UTC, sin importar la zona del servidor", () => {
    expect(h("10:00").toISOString()).toBe("2030-01-07T16:00:00.000Z");
    expect(fechaLocal(new Date("2030-01-08T04:30:00Z"))).toBe("2030-01-07"); // 22:30 del lunes en México
    expect(horaLocal(new Date("2030-01-07T16:15:00Z"))).toBe("10:15");
  });

  it("funciona en zonas con horario de verano (Tijuana en julio es UTC-7, en enero UTC-8)", () => {
    expect(horaLocalAUtc("2030-07-08", "10:00", "America/Tijuana").toISOString()).toBe("2030-07-08T17:00:00.000Z");
    expect(horaLocalAUtc("2030-01-07", "10:00", "America/Tijuana").toISOString()).toBe("2030-01-07T18:00:00.000Z");
  });

  it("día de la semana y fechas válidas", () => {
    expect(diaDeLaSemana(LUNES)).toBe(0);
    expect(diaDeLaSemana("2030-01-13")).toBe(6);
    expect(esFecha("2030-02-30")).toBe(false);
    expect(esFecha("7-ene")).toBe(false);
  });
});

describe("horarios libres", () => {
  it("cada 15 minutos y el servicio cabe antes del descanso", () => {
    const r = libres([ANA]);
    expect(r.slice(0, 2)).toEqual(["10:00", "10:15"]);
    expect(r).toContain("13:15");
    expect(r).not.toContain("13:30"); // 13:30 + 45 min cruzaría el descanso de 14 a 15
    expect(r).not.toContain("14:00");
    expect(r.at(-1)).toBe("18:15");
    expect(r).toHaveLength(28);
  });

  it("una cita quita los horarios que se enciman; tocarse no es encimarse", () => {
    const r = libres([{ ...ANA, ocupado: [{ start: h("11:00"), end: h("11:45") }] }]);
    expect(r).toContain("10:15");
    for (const t of ["10:30", "10:45", "11:00", "11:15", "11:30"]) expect(r).not.toContain(t);
    expect(r).toContain("11:45");
  });

  it("una ausencia de varios días bloquea el día completo", () => {
    const r = libres([{ ...ANA, ocupado: [{ start: h("00:00", "2030-01-05"), end: h("00:00", "2030-01-09") }] }]);
    expect(r).toEqual([]);
  });

  it("no ofrece horarios pasados y respeta 1 hora de anticipación", () => {
    expect(libres([ANA], 45, h("10:20"))[0]).toBe("11:30"); // mínimo 11:20; el siguiente del paso es 11:30
  });

  it("fuera de hoy…hoy+30 días no hay horarios", () => {
    expect(libres([{ ...ANA, bloques: [{ dayOfWeek: 5, start: "10:00", end: "14:00" }] }], 45, DOMINGO_PREVIO, "2030-01-05")).toEqual([]);
    expect(libres([{ ...ANA, bloques: [{ dayOfWeek: 0, start: "10:00", end: "14:00" }] }], 45, DOMINGO_PREVIO, "2030-02-11")).toEqual([]);
  });

  it("día sin bloques es día libre", () => {
    expect(libres([ANA], 45, DOMINGO_PREVIO, "2030-01-08")).toEqual([]);
  });

  it("varios estilistas: junta horarios y dice quién está libre en cada uno", () => {
    const beto: EstilistaDelDia = { id: "beto", bloques: [{ dayOfWeek: 0, start: "12:00", end: "16:00" }], ocupado: [] };
    const r = horariosLibres({ fecha: LUNES, duracionMin: 45, estilistas: [ANA, beto], ahora: DOMINGO_PREVIO });
    const por = Object.fromEntries(r.map((x) => [horaLocal(x.inicio), x.estilistas]));
    expect(por["10:00"]).toEqual(["ana"]);
    expect(por["12:00"].sort()).toEqual(["ana", "beto"]);
    expect(por["14:00"]).toEqual(["beto"]); // Ana está en su descanso
  });
});
