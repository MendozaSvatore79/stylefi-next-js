/**
 * Toda ruta de app/api/admin/ exige una sesión de administración verificada en la base.
 * Las rutas y sus métodos se descubren solos: una ruta nueva sin requireAdmin() hace fallar estas pruebas.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Query } from "./fake-db";

const sesion = vi.hoisted(() => ({ actual: null as null | { user: Record<string, unknown> } }));
const db = vi.hoisted(() => ({ handler: (() => []) as (q: { text: string; values: unknown[] }) => unknown[] }));
let queries: Query[] = [];

vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => sesion.actual), default: vi.fn() }));
vi.mock("@/lib/db-init", () => ({ ensureStylehubSchema: vi.fn(async () => undefined) }));
vi.mock("@/lib/db", () => ({
  // Imita la función con plantillas de Neon: guarda cada consulta y responde con db.handler
  getDb: () => (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = { text: strings.join("$?").replace(/\s+/g, " ").trim(), values };
    queries.push(query);
    return Promise.resolve(db.handler(query));
  },
}));
vi.mock("@/lib/email", () => ({ sendSupportConversationEmail: vi.fn(async () => undefined) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), connection: vi.fn(async () => undefined) }));

const ADMIN = { id: "a0000000-0000-0000-0000-000000000001", email: "admin@stylefi.test" };
const esConsultaDeAdmin = (q: Query) => q.text.includes("account_type = 'admin'") && q.text.includes("is_banned = FALSE");

function adminEnLaBase(q: Query) {
  return esConsultaDeAdmin(q) && q.values[0] === ADMIN.id ? [ADMIN] : [];
}

// --- descubrir rutas y métodos ---------------------------------------------------------------
const RAIZ = path.resolve(import.meta.dirname, "..");
const METODOS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

function rutasAdmin(dir = path.join(RAIZ, "app/api/admin")): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = path.join(dir, nombre);
    if (statSync(ruta).isDirectory()) return rutasAdmin(ruta);
    return nombre === "route.ts" ? [ruta] : [];
  });
}

const ARCHIVOS = rutasAdmin();
const CASOS = ARCHIVOS.flatMap((archivo) => {
  const fuente = readFileSync(archivo, "utf8");
  return METODOS.filter((m) => new RegExp(`export async function ${m}\\(`).test(fuente)).map((metodo) => ({
    archivo: path.relative(RAIZ, archivo),
    metodo,
  }));
});

async function llamar(archivo: string, metodo: string, cuerpo: unknown = {}) {
  const mod = (await import(path.join(RAIZ, archivo))) as Record<string, (r: Request) => Promise<Response>>;
  const init: RequestInit = { method: metodo, headers: { "Content-Type": "application/json" } };
  if (metodo !== "GET") init.body = JSON.stringify(cuerpo);
  return mod[metodo](new Request("http://localhost/api/admin/x?status=pending", init));
}

beforeEach(() => {
  sesion.actual = null;
  queries = [];
  db.handler = adminEnLaBase;
});

describe("rutas de administración", () => {
  it("se descubren las cuatro rutas y sus nueve métodos", () => {
    expect(ARCHIVOS).toHaveLength(4);
    expect(CASOS.length).toBe(9);
  });

  it.each(CASOS)("$archivo $metodo: sin sesión responde 401 y no consulta la base", async ({ archivo, metodo }) => {
    const r = await llamar(archivo, metodo);
    expect(r.status).toBe(401);
    expect(queries).toEqual([]);
  });

  it.each(CASOS.flatMap((c) => ["cliente", "negocio"].map((tipo) => ({ ...c, tipo }))))(
    "$archivo $metodo: una cuenta de $tipo recibe 403 y no consulta la base",
    async ({ archivo, metodo, tipo }) => {
      sesion.actual = { user: { id: "u1", email: "x@test", accountType: tipo } };
      const r = await llamar(archivo, metodo);
      expect(r.status).toBe(403);
      expect(queries).toEqual([]);
    },
  );

  it.each(CASOS)(
    "$archivo $metodo: un JWT que dice admin pero la base no lo confirma recibe 403",
    async ({ archivo, metodo }) => {
      sesion.actual = { user: { id: "ex-admin", email: "ex@test", accountType: "admin" } };
      const r = await llamar(archivo, metodo);
      expect(r.status).toBe(403);
      expect(queries.every(esConsultaDeAdmin)).toBe(true); // solo la verificación, nada más
    },
  );

  it.each(CASOS)("$archivo $metodo: la cuenta de administración pasa", async ({ archivo, metodo }) => {
    sesion.actual = { user: { id: ADMIN.id, email: ADMIN.email, accountType: "admin" } };
    const r = await llamar(archivo, metodo);
    expect([401, 403]).not.toContain(r.status);
  });

  it.each(CASOS)("$archivo $metodo: requireAdmin() es lo primero que hace el handler", ({ archivo, metodo }) => {
    const fuente = readFileSync(path.join(RAIZ, archivo), "utf8");
    const cuerpo = fuente.split(new RegExp(`export async function ${metodo}\\([^)]*\\) \\{`))[1];
    expect(cuerpo.trimStart().startsWith("const auth = await requireAdmin();")).toBe(true);
  });
});

describe("identidad del administrador", () => {
  beforeEach(() => {
    sesion.actual = { user: { id: ADMIN.id, email: ADMIN.email, accountType: "admin" } };
  });

  it("quien aprueba una sucursal sale de la sesión, no del cuerpo de la petición", async () => {
    db.handler = (q) => (esConsultaDeAdmin(q) ? adminEnLaBase(q) : q.text.startsWith("UPDATE") ? [{ id: "b1" }] : []);
    const r = await llamar("app/api/admin/branch-verifications/route.ts", "PATCH", {
      branchId: "b1",
      status: "approved",
      reviewer: "alguien-mas@evil.test",
    });
    expect(r.status).toBe(200);
    const update = queries.find((q) => q.text.startsWith("UPDATE stylehub_business_branches"))!;
    expect(update.values).toContain(ADMIN.email);
    expect(update.values).not.toContain("alguien-mas@evil.test");
  });

  it("quien responde un ticket sale de la sesión, no del cuerpo de la petición", async () => {
    const ticket = { id: "t1", contact_email: "c@test", contact_name: "C", assigned_admin_email: null };
    db.handler = (q) =>
      esConsultaDeAdmin(q) ? adminEnLaBase(q) : q.text.includes("FROM stylehub_support_tickets") ? [ticket] : [];
    const r = await llamar("app/api/admin/support-tickets/route.ts", "PATCH", {
      ticketId: "t1",
      action: "reply",
      message: "Hola",
      adminEmail: "alguien-mas@evil.test",
    });
    expect(r.status).toBe(200);
    const insert = queries.find((q) => q.text.startsWith("INSERT INTO stylehub_support_messages"))!;
    expect(insert.values).toContain(ADMIN.email);
    expect(JSON.stringify(queries.map((q) => q.values))).not.toContain("alguien-mas@evil.test");
  });

  it("el panel de usuarios no lista, edita, suspende ni borra cuentas de administración", async () => {
    db.handler = adminEnLaBase;
    await llamar("app/api/admin/users/route.ts", "GET");
    await llamar("app/api/admin/users/route.ts", "DELETE", { userId: "u9" });
    for (const accion of ["edit", "ban", "unban"]) {
      await llamar("app/api/admin/users/route.ts", "PATCH", { userId: "u9", action: accion, email: "a@b.test", firstName: "A" });
    }
    const sobreUsuarios = queries.filter((q) => !esConsultaDeAdmin(q) && /stylehub_users/.test(q.text));
    expect(sobreUsuarios.length).toBeGreaterThanOrEqual(5);
    for (const q of sobreUsuarios) {
      expect(q.text, q.text).toContain("account_type <> 'admin'");
    }
  });
});
