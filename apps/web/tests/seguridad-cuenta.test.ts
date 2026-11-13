/** /api/account/security: eliminar la cuenta con correo escrito + token por correo; borra en la base y en Clerk. */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE, GET, POST } from "@/app/api/account/security/route";
import { createOtpSalt, hashOtpCode } from "@/lib/otp";

const estado = vi.hoisted(() => ({
  sesion: { user: { id: "u1", accountType: "cliente", email: "ana@prueba.invalid", authProvider: "credentials" } } as null | Record<string, unknown>,
  token: null as null | { id: string; token_hash: string; token_salt: string; attempts: number; expires_at: string },
  consultas: [] as Array<{ texto: string; valores: unknown[] }>,
  correos: [] as Array<{ to: string; token: string }>,
  borradosEnClerk: [] as string[],
}));

vi.mock("@/lib/sesion", () => ({ obtenerSesion: vi.fn(async () => estado.sesion) }));
vi.mock("@/lib/db-init", () => ({ ensureStylehubSchema: vi.fn(async () => undefined) }));
vi.mock("@/lib/email", () => ({
  sendAccountDeletionTokenEmail: vi.fn(async (d: { to: string; token: string }) => {
    estado.correos.push(d);
  }),
}));
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({ users: { deleteUser: vi.fn(async (id: string) => estado.borradosEnClerk.push(id)) } }),
}));
vi.mock("@/lib/db", () => ({
  getDb: () => (strings: TemplateStringsArray, ...valores: unknown[]) => {
    const texto = strings.join("$?").replace(/\s+/g, " ").trim();
    estado.consultas.push({ texto, valores });
    if (texto.startsWith("SELECT id, email, account_type")) {
      return Promise.resolve([{ id: "u1", email: "ana@prueba.invalid", account_type: "cliente", first_name: "Ana", business_name: null, clerk_user_id: "user_ana" }]);
    }
    if (texto.startsWith("SELECT id, token_hash")) return Promise.resolve(estado.token ? [estado.token] : []);
    return Promise.resolve([]);
  },
}));

const pedir = (metodo: "POST" | "DELETE", cuerpo: unknown) =>
  new Request("http://localhost/api/account/security", { method: metodo, body: JSON.stringify(cuerpo) });

function tokenValido(valor = "123456", extra: Partial<NonNullable<typeof estado.token>> = {}) {
  const salt = createOtpSalt();
  estado.token = { id: "t1", token_hash: hashOtpCode(valor, salt), token_salt: salt, attempts: 0, expires_at: new Date(Date.now() + 60_000).toISOString(), ...extra };
}

beforeEach(() => {
  estado.sesion = { user: { id: "u1", accountType: "cliente", email: "ana@prueba.invalid", authProvider: "credentials" } };
  estado.token = null;
  estado.consultas = [];
  estado.correos = [];
  estado.borradosEnClerk = [];
});

describe("/api/account/security", () => {
  it("401 sin sesión", async () => {
    estado.sesion = null;
    expect((await GET()).status).toBe(401);
  });

  it("GET: correo, tipo de cuenta y si entra con Google", async () => {
    expect(await (await GET()).json()).toEqual({ email: "ana@prueba.invalid", accountType: "cliente", hasGoogle: false });
  });

  it("POST: sin escribir el correo exacto no envía token", async () => {
    expect((await POST(pedir("POST", { confirmation: "otro@x.invalid" }))).status).toBe(400);
    expect(estado.correos).toHaveLength(0);
  });

  it("POST: con el correo, guarda el token (con hash) y lo envía por correo", async () => {
    expect((await POST(pedir("POST", { confirmation: " ANA@prueba.invalid " }))).status).toBe(200);
    expect(estado.correos).toHaveLength(1);
    const alta = estado.consultas.find((c) => c.texto.startsWith("INSERT INTO stylehub_account_deletion_tokens"))!;
    expect(alta.valores).not.toContain(estado.correos[0].token);
  });

  it("DELETE: token incorrecto suma un intento y no borra nada", async () => {
    tokenValido("123456");
    expect((await DELETE(pedir("DELETE", { confirmation: "ana@prueba.invalid", token: "654321" }))).status).toBe(400);
    expect(estado.consultas.some((c) => c.texto.includes("attempts = attempts + 1"))).toBe(true);
    expect(estado.consultas.some((c) => c.texto.startsWith("DELETE FROM stylehub_users"))).toBe(false);
    expect(estado.borradosEnClerk).toHaveLength(0);
  });

  it.each([
    { motivo: "vencido", extra: { expires_at: new Date(Date.now() - 1000).toISOString() }, status: 410 },
    { motivo: "con 5 intentos", extra: { attempts: 5 }, status: 429 },
  ])("DELETE: token $motivo → $status", async ({ extra, status }) => {
    tokenValido("123456", extra);
    expect((await DELETE(pedir("DELETE", { confirmation: "ana@prueba.invalid", token: "123456" }))).status).toBe(status);
    expect(estado.borradosEnClerk).toHaveLength(0);
  });

  it("DELETE: correo + token correctos borran la cuenta en la base y en Clerk", async () => {
    tokenValido("123456");
    expect((await DELETE(pedir("DELETE", { confirmation: "ana@prueba.invalid", token: "123456" }))).status).toBe(200);
    expect(estado.consultas.some((c) => c.texto.startsWith("DELETE FROM stylehub_users") && c.valores.includes("u1"))).toBe(true);
    expect(estado.borradosEnClerk).toEqual(["user_ana"]);
  });
});
