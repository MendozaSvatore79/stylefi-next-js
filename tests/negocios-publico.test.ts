/** La ficha pública de un negocio no expone el correo de sus estilistas. */
import { describe, expect, it, vi } from "vitest";

const consultas = vi.hoisted(() => [] as string[]);

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(async () => ({ user: { id: "c0000000-0000-0000-0000-000000000001", accountType: "cliente" } })),
  default: vi.fn(),
}));
vi.mock("@/lib/db-init", () => ({ ensureStylehubSchema: vi.fn(async () => undefined) }));
vi.mock("@/lib/db", () => ({
  getDb: () => (strings: TemplateStringsArray) => {
    const texto = strings.join("$?").replace(/\s+/g, " ").trim();
    consultas.push(texto);
    if (texto.includes("FROM stylehub_users u") && texto.includes("u.id = $?")) return Promise.resolve([{ id: "negocio" }]);
    return Promise.resolve([]);
  },
}));

describe("GET /api/businesses?businessId=…", () => {
  it("la consulta de estilistas no pide el correo", async () => {
    const { GET } = await import("@/app/api/businesses/route");
    const res = await GET(new Request("http://x/api/businesses?businessId=b0000000-0000-0000-0000-000000000001"));
    expect(res.status).toBe(200);
    const estilistas = consultas.find((q) => q.includes("FROM stylehub_business_stylists st"));
    expect(estilistas).toBeDefined();
    expect(estilistas).not.toMatch(/email/i);
    expect(estilistas).toMatch(/st\.first_name/);
  });
});
