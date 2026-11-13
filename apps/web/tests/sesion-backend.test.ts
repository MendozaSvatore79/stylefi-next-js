/**
 * lib/sesion.ts con el backend configurado: los layouts y la página de registro preguntan a GET /entrar del backend
 * (con el token de Clerk de la petición) y NO consultan la base desde Vercel.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  destino: "/iniciar-sesion" as string,
  status: 200,
  pedidas: [] as Array<{ url: string; auth: string | null }>,
  consultasALaBase: 0,
  clerkUser: null as null | Record<string, unknown>,
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({ userId: "user_x", getToken: async () => "tok" })),
  currentUser: vi.fn(async () => estado.clerkUser),
}));
vi.mock("@/lib/db", () => ({
  getDb: () => () => {
    estado.consultasALaBase += 1;
    return Promise.resolve([]);
  },
}));

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.prueba");
  estado.pedidas = [];
  estado.consultasALaBase = 0;
  estado.status = 200;
  estado.clerkUser = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      estado.pedidas.push({ url, auth: new Headers(init.headers).get("Authorization") });
      return Response.json({ destino: estado.destino }, { status: estado.status });
    }),
  );
});

describe("accesoAlPanel con backend", () => {
  it.each([
    ["/iniciar-sesion", "admin", { redirigir: "/iniciar-sesion?reason=unauthorized" }],
    ["/registro/completar", "cliente", { redirigir: "/registro/completar" }],
    ["/cuenta-suspendida", "negocio", { redirigir: "/cuenta-suspendida" }],
    ["/dashboard/negocio", "admin", { redirigir: "/dashboard/negocio" }],
    ["/dashboard/admin", "admin", { sesion: null }],
    ["/dashboard/cliente", "cliente", { sesion: null }],
  ] as const)("backend dice %s y el panel es %s", async (destino, tipo, esperado) => {
    estado.destino = destino;
    const { accesoAlPanel } = await import("@/lib/sesion");
    expect(await accesoAlPanel(tipo)).toEqual(esperado);
    expect(estado.pedidas).toEqual([{ url: "http://api.prueba/entrar", auth: "Bearer tok" }]);
    expect(estado.consultasALaBase).toBe(0);
  });

  it("si el backend falla, lanza (no deja pasar ni manda a registrarse)", async () => {
    estado.status = 503;
    const { accesoAlPanel } = await import("@/lib/sesion");
    await expect(accesoAlPanel("admin")).rejects.toThrow("503");
  });
});

describe("estadoDeRegistro con backend", () => {
  it("lista, baneada o sin sesión según /entrar, sin consultar la base", async () => {
    const { estadoDeRegistro } = await import("@/lib/sesion");
    estado.destino = "/dashboard/negocio";
    expect(await estadoDeRegistro()).toEqual({ estado: "lista", accountType: "negocio" });
    estado.destino = "/cuenta-suspendida";
    expect(await estadoDeRegistro()).toEqual({ estado: "baneada" });
    estado.destino = "/iniciar-sesion";
    expect(await estadoDeRegistro()).toEqual({ estado: "sin-sesion" });
    expect(estado.consultasALaBase).toBe(0);
  });

  it("sin registro: los datos para prellenar salen de Clerk (correo solo si está verificado)", async () => {
    estado.destino = "/registro/completar";
    estado.clerkUser = {
      id: "user_x",
      primaryEmailAddressId: "e1",
      emailAddresses: [{ id: "e1", emailAddress: "Nueva@Prueba.invalid", verification: { status: "verified" } }],
      firstName: "Nora",
      lastName: "Paz",
      imageUrl: null,
      externalAccounts: [],
    };
    const { estadoDeRegistro } = await import("@/lib/sesion");
    expect(await estadoDeRegistro()).toMatchObject({
      estado: "sin-registro",
      clerk: { correoVerificado: "nueva@prueba.invalid", nombre: "Nora", apellido: "Paz" },
    });
    expect(estado.consultasALaBase).toBe(0);
  });
});
