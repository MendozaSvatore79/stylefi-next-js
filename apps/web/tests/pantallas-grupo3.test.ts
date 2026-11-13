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

describe("todas las pantallas", () => {
  it("ninguna llama con fetch() a una ruta que ya vive en el backend (deben usar api(), que lleva el token)", async () => {
    const { readdirSync, statSync } = await import("node:fs");
    const { vaAlBackend } = await import("@/lib/api");
    const raiz = path.resolve(import.meta.dirname, "..");
    const archivos: string[] = [];
    const recorrer = (dir: string) => {
      for (const nombre of readdirSync(dir)) {
        const completo = path.join(dir, nombre);
        if (statSync(completo).isDirectory()) {
          if (completo !== path.join(raiz, "app", "api")) recorrer(completo);
        } else if (/\.(tsx?|jsx?)$/.test(nombre)) archivos.push(completo);
      }
    };
    for (const dir of ["app", "components", "lib"]) recorrer(path.join(raiz, dir));
    const malas: string[] = [];
    for (const archivo of archivos) {
      const fuente = readFileSync(archivo, "utf8");
      for (const m of fuente.matchAll(/\bfetch\(\s*[`"'](\/api\/[^`"'?$]*)/g)) {
        if (vaAlBackend(m[1])) malas.push(`${path.relative(raiz, archivo)}: ${m[1]}`);
      }
    }
    expect(archivos.length).toBeGreaterThan(20);
    expect(malas).toEqual([]);
  });
});
