/** Horario semanal de sucursal: funciones de lib/horario.ts (escritas sin correr, regla de ahorro de Eric). */
import { describe, expect, it } from "vitest";

import { cambiarDia, copiarLunesAViernes, diasInvalidos, horarioAnterior, horarioPorOmision, HORAS, leerHorario, resumenHorario } from "@/lib/horario";

describe("horario semanal", () => {
  it("horas cada 30 minutos de 06:00 a 23:30", () => {
    expect(HORAS[0]).toBe("06:00");
    expect(HORAS[1]).toBe("06:30");
    expect(HORAS.at(-1)).toBe("23:30");
    expect(HORAS).toHaveLength(36);
  });

  it("por omisión: L–V 09:00–20:00, sábado 09:00–16:00, domingo cerrado", () => {
    expect(resumenHorario(horarioPorOmision(), "es")).toEqual(["Lun–Vie 09:00–20:00", "Sáb 09:00–16:00", "Dom cerrado"]);
    expect(resumenHorario(horarioPorOmision(), "en")).toEqual(["Mon–Fri 09:00–20:00", "Sat 09:00–16:00", "Sun closed"]);
  });

  it("copiar el lunes a martes–viernes no toca sábado ni domingo", () => {
    let h = cambiarDia(horarioPorOmision(), 0, { abre: "10:00", cierra: "18:30" });
    h = cambiarDia(h, 3, { abierto: false });
    const copiado = copiarLunesAViernes(h);
    expect(copiado.slice(0, 5).map((d) => [d.dia, d.abre, d.cierra])).toEqual([0, 1, 2, 3, 4].map((dia) => [dia, "10:00", "18:30"]));
    expect(copiado[5]).toEqual(h[5]);
    expect(copiado[6]).toEqual(h[6]);
  });

  it("cerrar borra las horas; abrir un día cerrado le pone 09:00–20:00", () => {
    const cerrado = cambiarDia(horarioPorOmision(), 2, { abierto: false })[2];
    expect(cerrado).toEqual({ dia: 2, abierto: false, abre: null, cierra: null });
    expect(cambiarDia(horarioPorOmision(), 6, { abierto: true })[6]).toEqual({ dia: 6, abierto: true, abre: "09:00", cierra: "20:00" });
  });

  it("marca los días con la apertura igual o después del cierre", () => {
    let h = cambiarDia(horarioPorOmision(), 1, { abre: "20:00" });
    h = cambiarDia(h, 4, { abre: "21:00", cierra: "10:00" });
    expect(diasInvalidos(h)).toEqual([1, 4]);
    expect(diasInvalidos(horarioPorOmision())).toEqual([]);
  });

  it("leerHorario acepta los 7 días (en cualquier orden) y rechaza lo demás", () => {
    expect(leerHorario([...horarioPorOmision()].reverse())?.map((d) => d.dia)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    for (const v of [null, undefined, "texto", [], horarioPorOmision().slice(0, 6)]) expect(leerHorario(v)).toBeNull();
  });

  it("horario anterior (texto libre) para las sucursales sin horario semanal", () => {
    expect(horarioAnterior("9 am", "8 pm")).toBe("9 am – 8 pm");
    expect(horarioAnterior("  ", "8 pm")).toBe("8 pm");
    expect(horarioAnterior(null, null)).toBeNull();
  });
});
