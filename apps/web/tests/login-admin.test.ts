/** El acceso de administración ya no se concede comparando con ADMIN_EMAIL/ADMIN_PASSWORD. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ filas: [] as unknown[] }));
const nav = vi.hoisted(() => ({ redirect: vi.fn((url: string) => { throw new Error(`REDIRECT ${url}`); }) }));
const sesion = vi.hoisted(() => ({ actual: null as null | { user: Record<string, unknown> } }));

vi.mock("@/lib/db-init", () => ({ ensureStylehubSchema: vi.fn(async () => undefined) }));
vi.mock("@/lib/db", () => ({ getDb: () => vi.fn(async () => db.filas) }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => sesion.actual), default: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: nav.redirect }));
vi.mock("@/components/admin-dashboard-shell", () => ({ default: () => null }));

import { hashPassword } from "@/lib/password";

function login(email: string, password: string) {
  return import("@/app/api/login/route").then(({ POST }) =>
    POST(new Request("http://localhost/api/login", { method: "POST", body: JSON.stringify({ email, password }) })),
  );
}

describe("/api/login", () => {
  beforeEach(() => {
    process.env.ADMIN_EMAIL = "admin@stylehub.com";
    process.env.ADMIN_PASSWORD = "contrasena-de-entorno";
  });
  afterEach(() => {
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;
  });

  it("las credenciales de las variables de entorno ya no dan acceso de administración", async () => {
    db.filas = []; // no existe en la base
    const r = await login("admin@stylehub.com", "contrasena-de-entorno");
    const datos = await r.json();
    expect(r.status).not.toBe(200);
    expect(datos.role).toBeUndefined();
  });

  it("una cuenta admin de la base entra y va al panel de administración", async () => {
    db.filas = [{ id: "a1", email: "jefa@test", password_hash: hashPassword("clave-larga-123"), account_type: "admin", email_verified: true, is_banned: false }];
    const r = await login("jefa@test", "clave-larga-123");
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ role: "admin", redirectTo: "/dashboard/admin" });
  });
});

describe("layout de /dashboard/admin", () => {
  it.each([null, { user: { id: "u1", accountType: "cliente" } }, { user: { id: "u2", accountType: "negocio" } }])(
    "redirige a iniciar sesión si la sesión es %j",
    async (s) => {
      sesion.actual = s;
      const { default: Layout } = await import("@/app/dashboard/admin/layout");
      await expect(Layout({ children: null })).rejects.toThrow("REDIRECT /iniciar-sesion?reason=unauthorized");
    },
  );

  it("muestra el panel a una cuenta de administración", async () => {
    sesion.actual = { user: { id: "a1", accountType: "admin" } };
    nav.redirect.mockClear();
    const { default: Layout } = await import("@/app/dashboard/admin/layout");
    await expect(Layout({ children: null })).resolves.toBeTruthy();
    expect(nav.redirect).not.toHaveBeenCalled();
  });
});
