/** El widget de soporte deja de consultar un ticket cerrado. */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CONSULTA_ABIERTO_MS, CONSULTA_CERRADO_MS, intervaloDeConsulta } from "@/lib/consulta-ticket";

describe("intervaloDeConsulta", () => {
  it("ticket cerrado: no se consulta más, con el widget abierto o cerrado", () => {
    expect(intervaloDeConsulta("closed", true)).toBeNull();
    expect(intervaloDeConsulta("closed", false)).toBeNull();
  });

  it("ticket activo o aún sin estado: 5 s con el widget abierto y 15 s cerrado", () => {
    for (const estado of ["open", "escalated", null]) {
      expect(intervaloDeConsulta(estado, true)).toBe(CONSULTA_ABIERTO_MS);
      expect(intervaloDeConsulta(estado, false)).toBe(CONSULTA_CERRADO_MS);
    }
    expect([CONSULTA_ABIERTO_MS, CONSULTA_CERRADO_MS]).toEqual([5000, 15000]);
  });
});

describe("OracleSupportWidget (no hay pruebas de componentes: guardia sobre el código)", () => {
  const fuente = readFileSync(path.resolve(import.meta.dirname, "../components/oracle-support-widget.tsx"), "utf8");
  const efecto = fuente.slice(fuente.indexOf("void refreshTicket(ticketId);\n    const intervalo"));

  it("consulta una vez y, cerrado el ticket, sale antes de escuchar el foco y de programar el intervalo", () => {
    expect(efecto).not.toBe(fuente);
    const consulta = efecto.indexOf("void refreshTicket(ticketId);");
    const salida = efecto.indexOf("if (intervalo === null)");
    expect(consulta).toBe(0);
    expect(salida).toBeGreaterThan(consulta);
    for (const paso of ['addEventListener("focus"', "window.setInterval("]) {
      expect(efecto.indexOf(paso)).toBeGreaterThan(salida);
    }
    expect(efecto).toContain("}, intervalo);");
  });

  it("al abrir el widget se vuelve a consultar, aunque el ticket esté cerrado (refreshTicket depende de open)", () => {
    expect(fuente).toContain("}, [forgetStoredTicket, open]);");
  });

  it("el efecto se vuelve a evaluar cuando cambia el estado del ticket", () => {
    expect(fuente).toContain("}, [open, refreshTicket, ticketId, ticketStatus]);");
  });
});
