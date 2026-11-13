/**
 * lib/sesion.ts con Clerk y la base simulados: la identidad viene de Clerk, los permisos de nuestra base, y una
 * cuenta existente se vincula solo por correo VERIFICADO y solo si no tiene otra cuenta de Clerk.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Fila = {
  id: string;
  account_type: "cliente" | "negocio" | "admin";
  email: string;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
  is_banned: boolean;
  clerk_user_id: string | null;
};

const estado = vi.hoisted(() => ({
  userId: null as string | null,
  clerkUser: null as null | Record<string, unknown>,
  filas: [] as Fila[],
  consultas: [] as string[],
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({ userId: estado.userId })),
  currentUser: vi.fn(async () => estado.clerkUser),
}));
vi.mock("@/lib/db", () => ({
  getDb: () => (strings: TemplateStringsArray, ...valores: unknown[]) => {
    const texto = strings.join("$?").replace(/\s+/g, " ").trim();
    estado.consultas.push(texto);
    if (texto.startsWith("SELECT") && texto.includes("WHERE clerk_user_id = $?")) {
      return Promise.resolve(estado.filas.filter((f) => f.clerk_user_id === valores[0]));
    }
    if (texto.startsWith("UPDATE stylehub_users SET clerk_user_id")) {
      const [clerkId, correo] = valores as [string, string];
      const f = estado.filas.find((x) => x.email === correo && x.clerk_user_id === null);
      if (!f) return Promise.resolve([]);
      f.clerk_user_id = clerkId;
      return Promise.resolve([f]);
    }
    return Promise.resolve([]);
  },
}));

const fila = (p: Partial<Fila>): Fila => ({
  id: "u1",
  account_type: "cliente",
  email: "ana@prueba.invalid",
  first_name: "Ana",
  last_name: "López",
  business_name: null,
  is_banned: false,
  clerk_user_id: null,
  ...p,
});

const clerk = (correo: string, verificado: boolean, google = false) => ({
  id: estado.userId,
  primaryEmailAddressId: "e1",
  emailAddresses: [{ id: "e1", emailAddress: correo, verification: { status: verificado ? "verified" : "unverified" } }],
  firstName: "Ana",
  lastName: "López",
  imageUrl: "https://img.clerk.invalid/ana.png",
  externalAccounts: google ? [{ provider: "oauth_google" }] : [],
});

beforeEach(() => {
  estado.userId = null;
  estado.clerkUser = null;
  estado.filas = [];
  estado.consultas = [];
});

describe("obtenerSesion", () => {
  it("sin sesión de Clerk: null y no consulta la base", async () => {
    const { obtenerSesion } = await import("@/lib/sesion");
    expect(await obtenerSesion()).toBeNull();
    expect(estado.consultas).toHaveLength(0);
  });

  it("cuenta ya vinculada: sesión con el tipo de cuenta de nuestra base", async () => {
    estado.userId = "user_ana";
    estado.clerkUser = clerk("ana@prueba.invalid", true, true);
    estado.filas = [fila({ clerk_user_id: "user_ana", account_type: "negocio", business_name: "Barbería" })];
    const { obtenerSesion } = await import("@/lib/sesion");
    expect(await obtenerSesion()).toEqual({
      user: {
        id: "u1",
        accountType: "negocio",
        email: "ana@prueba.invalid",
        name: "Ana López",
        image: "https://img.clerk.invalid/ana.png",
        authProvider: "google",
      },
    });
  });

  it("cuenta existente sin vincular + correo verificado en Clerk: se vincula (solo si no tenía otra cuenta de Clerk)", async () => {
    estado.userId = "user_nuevo";
    estado.clerkUser = clerk("ANA@prueba.invalid ", true);
    estado.filas = [fila({})];
    const { obtenerSesion } = await import("@/lib/sesion");
    expect((await obtenerSesion())?.user.id).toBe("u1");
    expect(estado.filas[0].clerk_user_id).toBe("user_nuevo");
    expect(estado.consultas.find((c) => c.startsWith("UPDATE"))).toContain("clerk_user_id IS NULL");
  });

  it("correo NO verificado en Clerk: no vincula nada", async () => {
    estado.userId = "user_nuevo";
    estado.clerkUser = clerk("ana@prueba.invalid", false);
    estado.filas = [fila({})];
    const { obtenerSesion } = await import("@/lib/sesion");
    expect(await obtenerSesion()).toBeNull();
    expect(estado.filas[0].clerk_user_id).toBeNull();
    expect(estado.consultas.some((c) => c.startsWith("UPDATE"))).toBe(false);
  });

  it("una cuenta ya vinculada a otra persona de Clerk no se le entrega a quien tenga el mismo correo", async () => {
    estado.userId = "user_intruso";
    estado.clerkUser = clerk("ana@prueba.invalid", true);
    estado.filas = [fila({ clerk_user_id: "user_ana" })];
    const { obtenerSesion } = await import("@/lib/sesion");
    expect(await obtenerSesion()).toBeNull();
    expect(estado.filas[0].clerk_user_id).toBe("user_ana");
  });

  it("cuenta baneada: sin sesión", async () => {
    estado.userId = "user_ana";
    estado.filas = [fila({ clerk_user_id: "user_ana", is_banned: true })];
    const { obtenerSesion } = await import("@/lib/sesion");
    expect(await obtenerSesion()).toBeNull();
  });
});

describe("accesoAlPanel (layouts del panel)", () => {
  it("sin sesión de Clerk: a iniciar sesión", async () => {
    const { accesoAlPanel } = await import("@/lib/sesion");
    expect(await accesoAlPanel("admin")).toEqual({ redirigir: "/iniciar-sesion?reason=unauthorized" });
  });

  it("con Clerk pero sin cuenta en StyleFi: a completar el registro", async () => {
    estado.userId = "user_nuevo";
    estado.clerkUser = clerk("nueva@prueba.invalid", true);
    const { accesoAlPanel } = await import("@/lib/sesion");
    expect(await accesoAlPanel("cliente")).toEqual({ redirigir: "/registro/completar" });
  });

  it("baneada: a la página de cuenta suspendida", async () => {
    estado.userId = "user_ana";
    estado.filas = [fila({ clerk_user_id: "user_ana", is_banned: true })];
    const { accesoAlPanel } = await import("@/lib/sesion");
    expect(await accesoAlPanel("cliente")).toEqual({ redirigir: "/cuenta-suspendida" });
  });

  it.each([
    ["cliente", "/dashboard/cliente"],
    ["negocio", "/dashboard/negocio"],
  ] as const)("una cuenta de %s que abre el panel de admin va a su propio panel", async (tipo, destino) => {
    estado.userId = "user_ana";
    estado.filas = [fila({ clerk_user_id: "user_ana", account_type: tipo })];
    const { accesoAlPanel } = await import("@/lib/sesion");
    expect(await accesoAlPanel("admin")).toEqual({ redirigir: destino });
  });

  it("la cuenta del tipo correcto entra", async () => {
    estado.userId = "user_jefa";
    estado.filas = [fila({ id: "a1", clerk_user_id: "user_jefa", account_type: "admin" })];
    const { accesoAlPanel } = await import("@/lib/sesion");
    const r = await accesoAlPanel("admin");
    expect("sesion" in r && r.sesion.user.accountType).toBe("admin");
  });
});
