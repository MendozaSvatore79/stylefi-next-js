/** Bucle /iniciar-sesion ↔ /entrar cuando el backend ya no reconoce la sesión que Clerk conserva en el navegador. */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { debeReiniciarSesion, DESTINO_TRAS_REINICIO } from "@/lib/reinicio-sesion";

describe("debeReiniciarSesion", () => {
  it("con el aviso unauthorized y sesión de Clerk cargada: cerrar la sesión", () => {
    expect(debeReiniciarSesion({ aviso: "unauthorized", isLoaded: true, isSignedIn: true })).toBe(true);
  });

  it("sin sesión de Clerk, o mientras Clerk carga, no se cierra nada", () => {
    expect(debeReiniciarSesion({ aviso: "unauthorized", isLoaded: true, isSignedIn: false })).toBe(false);
    expect(debeReiniciarSesion({ aviso: "unauthorized", isLoaded: false, isSignedIn: undefined })).toBe(false);
    expect(debeReiniciarSesion({ aviso: "unauthorized", isLoaded: false, isSignedIn: true })).toBe(false);
  });

  it("sin el aviso (entrar o registrarse normalmente) no se cierra la sesión", () => {
    expect(debeReiniciarSesion({ isLoaded: true, isSignedIn: true })).toBe(false);
    expect(debeReiniciarSesion({ aviso: "otro", isLoaded: true, isSignedIn: true })).toBe(false);
  });

  it("después de cerrar la sesión vuelve al mismo aviso", () => {
    expect(DESTINO_TRAS_REINICIO).toBe("/iniciar-sesion?reason=unauthorized");
  });
});

describe("MarcoAcceso (no hay pruebas de componentes: guardia sobre el código)", () => {
  const fuente = readFileSync(path.resolve(import.meta.dirname, "../components/marco-acceso.tsx"), "utf8");

  it("decide con debeReiniciarSesion y cierra la sesión de Clerk hacia el aviso", () => {
    expect(fuente).toContain("debeReiniciarSesion({ aviso, isLoaded, isSignedIn })");
    expect(fuente).toContain("signOut({ redirectUrl: DESTINO_TRAS_REINICIO })");
  });

  it("mientras cierra la sesión no muestra el formulario de Clerk (que reiniciaría el bucle)", () => {
    expect(fuente).toMatch(/\{cerrandoSesion \? <p[^>]*>Reiniciando sesión…<\/p> : children\}/);
  });
});
