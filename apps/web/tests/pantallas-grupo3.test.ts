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

  it("la portada pregunta el modo mantenimiento al backend desde el servidor (fase 4: sin respaldo en la base)", () => {
    const fuente = leer("app/page.tsx");
    expect(fuente).toContain('apiServidor("/live-dashboard")');
    expect(fuente).not.toContain("getLiveDashboardPayload");
  });

  it("fase 4: no quedan rutas de datos en Next ni código que lea la base", async () => {
    const { existsSync } = await import("node:fs");
    expect(existsSync(path.resolve(import.meta.dirname, "..", "app/api"))).toBe(false);
    for (const lib of ["db", "db-init", "booking", "stylist-config", "storage", "oracle-support", "email", "otp", "admin-auth", "live-dashboard", "stripe"]) {
      expect(existsSync(path.resolve(import.meta.dirname, "..", `lib/${lib}.ts`))).toBe(false);
    }
    expect(leer("lib/sesion.ts")).not.toMatch(/getDb|@\/lib\/db/);
  });
});

describe("portada: orden de los módulos", () => {
  it("los que están en mantenimiento van primero (siempre se ven); máximo 4; el resto conserva su orden", async () => {
    const { modulosDeLaPortada } = await import("@/components/live-dashboard-panel");
    const m = (key: string, isMaintenance = false) => ({ key, isMaintenance });
    const nueve = [m("salones"), m("citas"), m("wallet"), m("config"), m("sucursales"), m("servicios"), m("estilistas", true), m("citas-negocio"), m("config-negocio", true)];
    expect(modulosDeLaPortada(nueve).map((x) => x.key)).toEqual(["estilistas", "config-negocio", "salones", "citas"]);
    expect(modulosDeLaPortada(nueve.map((x) => ({ ...x, isMaintenance: false }))).map((x) => x.key)).toEqual(["salones", "citas", "wallet", "config"]);
    expect(modulosDeLaPortada([])).toEqual([]);
  });
});

describe("soporte (AURA)", () => {
  it("el widget manda el código del ticket en todas sus llamadas, lo guarda al crear y lo olvida si el ticket ya no se puede ver", () => {
    const fuente = leer("components/oracle-support-widget.tsx");
    const llamadas = [...fuente.matchAll(/api\((?:`|")\/api\/support\/oracle[\s\S]*?\)\s*;/g)].map((m) => m[0]);
    // 2 llamadas: crear/enviar y sincronizar. La de confirmar cierre o reabrir (updateTicketStatus) no tenía botón y se borró.
    expect(llamadas).toHaveLength(2);
    for (const llamada of llamadas) expect(llamada).toContain("ticketHeaders(");
    expect(fuente).toContain('"X-Ticket-Key"');
    expect(fuente).toContain("window.localStorage.setItem(supportTicketKeyStorageKey, payload.accessKey)");
    expect(fuente).toMatch(/response\.status === 404\)[\s\S]{0,200}forgetStoredTicket\(/);
    expect(fuente).toContain("maxLength={2000}");
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

describe("entrar", () => {
  it("pregunta a /entrar solo con la sesión de Clerk lista; sin sesión espera y luego va al login", () => {
    const fuente = leer("app/entrar/page.tsx");
    expect(fuente).toContain("useAuth()");
    const efectos = fuente.split("useEffect(").slice(1);
    const conLlamada = efectos.find((e) => e.includes('api("/api/entrar"'));
    expect(conLlamada).toBeDefined();
    expect(conLlamada).toMatch(/if \(!isLoaded \|\| !isSignedIn\) return;[\s\S]*api\("\/api\/entrar"/);
    const deEspera = efectos.find((e) => e.includes("ESPERA_SESION_MS"));
    expect(deEspera).toMatch(/if \(!isLoaded \|\| isSignedIn\) return;/);
  });
});
