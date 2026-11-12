/** Modelo del motor de citas (cambio 4.1). */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({ fallarCon: null as null | string }));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(async () => ({ user: { id: "b0000000-0000-0000-0000-000000000001", accountType: "negocio" } })),
  default: vi.fn(),
}));
vi.mock("@/lib/db-init", () => ({ ensureStylehubSchema: vi.fn(async () => undefined) }));
vi.mock("@/lib/db", () => ({
  getDb: () => (strings: TemplateStringsArray) => {
    const texto = strings.join("?");
    if (estado.fallarCon && texto.includes("DELETE FROM stylehub_business_stylists")) {
      return Promise.reject(Object.assign(new Error("viola llave foránea"), { code: estado.fallarCon }));
    }
    return Promise.resolve([]);
  },
}));

describe("borrar un estilista", () => {
  it("si tiene citas responde 409 con un mensaje claro, no 500", async () => {
    estado.fallarCon = "23503";
    const { DELETE } = await import("@/app/api/business/stylists/route");
    const r = (await DELETE(new Request("http://localhost/x", { method: "DELETE", body: JSON.stringify({ id: "s1" }) }))) as Response;
    expect(r.status).toBe(409);
    expect((await r.json()).error).toContain("no disponible");
  });
});

describe("esquema", () => {
  const sql = readFileSync(path.resolve(import.meta.dirname, "../lib/db-init.ts"), "utf8");

  it("la restricción contra traslapes excluye las canceladas y las citas sin estilista", () => {
    expect(sql).toMatch(/EXCLUDE USING gist \(stylist_id WITH =, tstzrange\(scheduled_at, ends_at, '\[\)'\) WITH &&\)/);
    expect(sql).toContain("WHERE (stylist_id IS NOT NULL AND status <> 'cancelled')");
  });

  it("las tablas del motor se crean después de estilistas y servicios (orden de creación)", () => {
    const pos = (t: string) => sql.indexOf(`CREATE TABLE IF NOT EXISTS ${t}`);
    for (const nueva of ["stylehub_stylist_services", "stylehub_stylist_schedule_blocks", "stylehub_stylist_absences"]) {
      expect(pos(nueva)).toBeGreaterThan(pos("stylehub_business_stylists"));
      expect(pos(nueva)).toBeGreaterThan(pos("stylehub_business_services"));
    }
  });
});
