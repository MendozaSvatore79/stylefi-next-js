/**
 * Guardia sobre el código de las pantallas del grupo 3 (no hay pruebas de componentes en el proyecto).
 * Lo de verdad se verifica en el navegador; esto evita que vuelvan cosas que el backend ya rechaza.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const leer = (archivo: string) => readFileSync(path.resolve(import.meta.dirname, "..", archivo), "utf8");

describe("admin", () => {
  it("el correo se muestra de solo lectura (el backend rechaza cambiarlo)", () => {
    const fuente = leer("app/dashboard/admin/page.tsx");
    expect(fuente).toMatch(/<Input value=\{editUserForm\.email\} readOnly/);
    expect(fuente).not.toContain("email: event.target.value");
    expect(fuente).toContain("El correo lo cambia la persona desde su cuenta.");
  });
});

describe("portada y panel en vivo", () => {
  it("el panel público no muestra cifras ni actividad semanal; cada módulo dice En línea o En mantenimiento", () => {
    const fuente = leer("components/live-dashboard-panel.tsx");
    expect(fuente).not.toMatch(/primaryStat|secondaryStat|weeklyActivity/);
    expect(fuente).toContain('"En línea"');
    expect(fuente).toContain('"En mantenimiento"');
    expect(fuente).toContain('api("/api/live-dashboard"');
  });

  it("la portada pregunta el modo mantenimiento al backend desde el servidor (y a la base solo sin backend)", () => {
    const fuente = leer("app/page.tsx");
    expect(fuente).toContain('apiServidor("/live-dashboard")');
    expect(fuente.indexOf('apiServidor("/live-dashboard")')).toBeLessThan(fuente.indexOf("getLiveDashboardPayload()"));
  });
});
