/**
 * Borrado seguro en /admin/users: la lógica de lib/borrado-usuario.ts y una guardia sobre el panel
 * (no hay pruebas de componentes en el proyecto; el flujo completo se revisa en el navegador).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  correoCoincide,
  describirHistorial,
  type DesgloseDeHistorial,
  mensajeDeError,
  rutaDeBorrado,
  rutaDeRevision,
} from "../lib/borrado-usuario";

const limpio: DesgloseDeHistorial = { citas: 0, movimientos: 0, saldo: "0.00", stripe: false, tickets: 0 };
const respuesta = (status: number, cuerpo?: unknown) =>
  new Response(cuerpo === undefined ? "no es json" : JSON.stringify(cuerpo), { status });

describe("rutas", () => {
  it("revisión y borrado van por id en la ruta, codificado", () => {
    expect(rutaDeRevision("abc-123")).toBe("/api/admin/users/abc-123/borrado");
    expect(rutaDeBorrado("abc-123")).toBe("/api/admin/users/abc-123");
    expect(rutaDeBorrado("a/b?c")).toBe("/api/admin/users/a%2Fb%3Fc");
  });
});

describe("describirHistorial", () => {
  it("sin historial no hay motivos", () => {
    expect(describirHistorial(limpio)).toEqual([]);
  });

  it("un motivo por cada cosa, en singular o plural", () => {
    expect(describirHistorial({ citas: 1, movimientos: 2, saldo: "0.50", stripe: true, tickets: 1 })).toEqual([
      "1 cita (incluidas canceladas)",
      "2 movimientos del monedero",
      "saldo de $0.50 en el monedero",
      "cliente registrado en Stripe",
      "1 ticket de soporte",
    ]);
    expect(describirHistorial({ ...limpio, citas: 3, tickets: 2, movimientos: 1 })).toEqual([
      "3 citas (incluidas canceladas)",
      "1 movimiento del monedero",
      "2 tickets de soporte",
    ]);
  });

  it("saldo en cero no cuenta", () => {
    expect(describirHistorial({ ...limpio, saldo: "0.00" })).toEqual([]);
    expect(describirHistorial({ ...limpio, saldo: "0.01" })).toEqual(["saldo de $0.01 en el monedero"]);
  });
});

describe("correoCoincide", () => {
  it("ignora espacios y mayúsculas", () => {
    expect(correoCoincide("  Ana@Prueba.MX ", "ana@prueba.mx")).toBe(true);
  });

  it("otro correo, uno parcial o vacío no coinciden", () => {
    expect(correoCoincide("ana@prueba.m", "ana@prueba.mx")).toBe(false);
    expect(correoCoincide("beto@prueba.mx", "ana@prueba.mx")).toBe(false);
    expect(correoCoincide("", "")).toBe(false);
    expect(correoCoincide("   ", "ana@prueba.mx")).toBe(false);
  });
});

describe("mensajeDeError", () => {
  it("409 con historial: el error del backend más el desglose", async () => {
    const r = respuesta(409, {
      error: "No se puede eliminar: la cuenta tiene historial. Suspéndela en su lugar.",
      codigo: "con-historial",
      desglose: { ...limpio, citas: 1, stripe: true },
      sugerencia: "ban",
    });
    expect(await mensajeDeError(r, "delete")).toBe(
      "No se puede eliminar: la cuenta tiene historial. Suspéndela en su lugar. Tiene: 1 cita (incluidas canceladas), cliente registrado en Stripe.",
    );
  });

  it("409 genérico o 502 con cuerpo: el error del backend tal cual", async () => {
    expect(await mensajeDeError(respuesta(409, { error: "Tiene registros relacionados." }), "delete")).toBe(
      "Tiene registros relacionados.",
    );
    expect(await mensajeDeError(respuesta(502, { error: "Clerk no respondió." }), "ban")).toBe("Clerk no respondió.");
  });

  it("502 sin cuerpo legible: mensaje del servicio de inicio de sesión según la acción", async () => {
    expect(await mensajeDeError(respuesta(502), "delete")).toBe(
      "No se pudo eliminar la cuenta en el servicio de inicio de sesión. Intenta de nuevo.",
    );
    expect(await mensajeDeError(respuesta(502), "unban")).toBe(
      "No se pudo reactivar la cuenta en el servicio de inicio de sesión. Intenta de nuevo.",
    );
  });

  it("otro estado sin cuerpo: mensaje con la acción y el código", async () => {
    expect(await mensajeDeError(respuesta(500), "ban")).toBe("No se pudo suspender al usuario (error 500).");
    expect(await mensajeDeError(respuesta(404, { error: "  " }), "delete")).toBe(
      "No se pudo eliminar al usuario (error 404).",
    );
  });
});

describe("panel /dashboard/admin: guardia del borrado", () => {
  const fuente = readFileSync(path.resolve(import.meta.dirname, "..", "app/dashboard/admin/page.tsx"), "utf8");
  const cuerpoDe = (nombre: string) => {
    const inicio = fuente.indexOf(`const ${nombre} = async`);
    expect(inicio).toBeGreaterThan(-1);
    return fuente.slice(inicio, fuente.indexOf("\n  };\n", inicio));
  };

  it("Eliminar abre la revisión previa, no borra directo", () => {
    expect(fuente).toContain("onClick={() => void openDeleteDialog(user)}");
    expect(cuerpoDe("openDeleteDialog")).toContain("api(rutaDeRevision(user.id)");
    expect(fuente).not.toMatch(/setUserActionDialog\(\{[^}]*action: "delete"/);
  });

  it("borra con DELETE /api/admin/users/:id, sin userId en el cuerpo", () => {
    const run = cuerpoDe("runUserAction");
    expect(run).toContain('api(rutaDeBorrado(userId), { method: "DELETE" })');
    expect(fuente).not.toMatch(/method: "DELETE",\s*headers/);
  });

  it("los errores de borrar, banear y desbanear se muestran, no se ignoran", () => {
    for (const nombre of ["runUserAction", "openDeleteDialog"]) {
      const cuerpo = cuerpoDe(nombre);
      expect(cuerpo).toMatch(/if \(!response\.ok\) \{\s*(\/\/[^\n]*\n\s*)?setUserActionError\(await mensajeDeError\(response,/);
    }
    expect(fuente).toMatch(/\{userActionError \? \(\s*<div role="alert"/);
  });

  it("con historial muestra el desglose y ofrece suspender, sin botón de borrar", () => {
    const inicio = fuente.indexOf("{deleteDialog && !deleteDialog.revision.sePuede ? (");
    const fin = fuente.indexOf(") : deleteDialog ? (", inicio);
    expect(inicio).toBeGreaterThan(-1);
    const rama = fuente.slice(inicio, fin);
    expect(rama).toContain("describirHistorial(deleteDialog.revision.desglose)");
    expect(rama).toContain('void runUserAction("ban", deleteDialog.userId)');
    expect(rama).toContain("Suspender en su lugar");
    expect(rama).not.toContain('runUserAction("delete"');
  });

  it("sin historial, Confirmar solo se habilita y actúa con el correo correcto", () => {
    const inicio = fuente.indexOf(") : deleteDialog ? (");
    const rama = fuente.slice(inicio, fuente.indexOf(") : null}", inicio));
    expect(rama).toContain("disabled={!correoCoincide(deleteConfirmEmail, deleteDialog.revision.usuario.email)}");
    const guardia = rama.indexOf("if (!correoCoincide(deleteConfirmEmail, deleteDialog.revision.usuario.email)) {");
    const borrado = rama.indexOf('void runUserAction("delete", deleteDialog.userId)');
    expect(guardia).toBeGreaterThan(-1);
    expect(borrado).toBeGreaterThan(guardia);
  });
});
