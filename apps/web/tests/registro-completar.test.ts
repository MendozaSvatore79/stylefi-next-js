/** POST /api/registro/completar: crea la cuenta de quien ya entró con Clerk, sin tocar cuentas existentes. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  registro: { estado: "sin-sesion" } as Record<string, unknown>,
  consultas: [] as Array<{ texto: string; valores: unknown[] }>,
  insertar: [{ id: "nuevo", account_type: "cliente" }] as unknown[],
}));

vi.mock("@/lib/db-init", () => ({ ensureStylehubSchema: vi.fn(async () => undefined) }));
vi.mock("@/lib/sesion", async () => ({
  estadoDeRegistro: vi.fn(async () => estado.registro),
  inicioPorTipo: (t: string) => (t === "negocio" ? "/dashboard/negocio" : "/dashboard/cliente"),
}));
vi.mock("@/lib/db", () => ({
  getDb: () => (strings: TemplateStringsArray, ...valores: unknown[]) => {
    const texto = strings.join("$?").replace(/\s+/g, " ").trim();
    estado.consultas.push({ texto, valores });
    if (texto.startsWith("INSERT INTO stylehub_users")) return Promise.resolve(estado.insertar);
    return Promise.resolve([]);
  },
}));

const CLERK = { clerkUserId: "user_nueva", correoVerificado: "nueva@prueba.invalid", nombre: "Nueva", apellido: "Persona" };

async function enviar(cuerpo: unknown) {
  const { POST } = await import("@/app/api/registro/completar/route");
  const r = await POST(new Request("http://localhost/api/registro/completar", { method: "POST", body: JSON.stringify(cuerpo) }));
  return { status: r.status, datos: (await r.json()) as Record<string, unknown> };
}

beforeEach(() => {
  estado.registro = { estado: "sin-registro", clerk: CLERK };
  estado.consultas = [];
  estado.insertar = [{ id: "nuevo", account_type: "cliente" }];
});

describe("POST /api/registro/completar", () => {
  it("401 sin sesión de Clerk", async () => {
    estado.registro = { estado: "sin-sesion" };
    expect((await enviar({ accountType: "cliente", phone: "55" })).status).toBe(401);
  });

  it("403 si la cuenta está baneada", async () => {
    estado.registro = { estado: "baneada" };
    expect((await enviar({ accountType: "cliente", phone: "55" })).status).toBe(403);
  });

  it("si ya tiene cuenta, no crea otra: solo indica a dónde ir", async () => {
    estado.registro = { estado: "lista", accountType: "negocio" };
    const r = await enviar({ accountType: "cliente", phone: "55" });
    expect(r).toEqual({ status: 200, datos: { ok: true, redirectTo: "/dashboard/negocio" } });
    expect(estado.consultas).toHaveLength(0);
  });

  it("400 si Clerk no ha verificado el correo", async () => {
    estado.registro = { estado: "sin-registro", clerk: { ...CLERK, correoVerificado: null } };
    expect((await enviar({ accountType: "cliente", phone: "55" })).status).toBe(400);
    expect(estado.consultas).toHaveLength(0);
  });

  it.each([
    { motivo: "sin tipo de cuenta", cuerpo: { phone: "55" } },
    { motivo: "cliente sin teléfono", cuerpo: { accountType: "cliente" } },
    { motivo: "negocio sin RFC", cuerpo: { accountType: "negocio", firstName: "A", lastName: "B", businessName: "C", phone: "55" } },
    { motivo: "tipo admin (no se puede elegir)", cuerpo: { accountType: "admin", phone: "55" } },
  ])("400: $motivo", async ({ cuerpo }) => {
    expect((await enviar(cuerpo)).status).toBe(400);
    expect(estado.consultas).toHaveLength(0);
  });

  it("cliente: crea la cuenta con el correo y el id de Clerk, y su monedero", async () => {
    const r = await enviar({ accountType: "cliente", phone: "5512345678", email: "otro@malo.invalid" });
    expect(r).toEqual({ status: 200, datos: { ok: true, redirectTo: "/dashboard/cliente" } });
    const alta = estado.consultas.find((c) => c.texto.startsWith("INSERT INTO stylehub_users"))!;
    expect(alta.valores).toContain("nueva@prueba.invalid");
    expect(alta.valores).toContain("user_nueva");
    expect(alta.valores).not.toContain("otro@malo.invalid");
    expect(alta.texto).toContain("ON CONFLICT DO NOTHING");
    expect(estado.consultas.some((c) => c.texto.startsWith("INSERT INTO stylehub_client_wallets"))).toBe(true);
  });

  it("negocio: crea la cuenta con todos sus datos y sin monedero", async () => {
    estado.insertar = [{ id: "nuevo", account_type: "negocio" }];
    const r = await enviar({ accountType: "negocio", firstName: "Ana", lastName: "López", businessName: "Barbería", rfc: "abcd010101xyz", phone: "55" });
    expect(r.datos.redirectTo).toBe("/dashboard/negocio");
    const alta = estado.consultas.find((c) => c.texto.startsWith("INSERT INTO stylehub_users"))!;
    expect(alta.valores).toContain("ABCD010101XYZ");
    expect(estado.consultas.some((c) => c.texto.startsWith("INSERT INTO stylehub_client_wallets"))).toBe(false);
  });

  it("409 si el correo ya pertenece a otra cuenta: no la modifica", async () => {
    estado.insertar = [];
    const r = await enviar({ accountType: "cliente", phone: "55" });
    expect(r.status).toBe(409);
    expect(estado.consultas.some((c) => c.texto.startsWith("UPDATE"))).toBe(false);
  });
});
