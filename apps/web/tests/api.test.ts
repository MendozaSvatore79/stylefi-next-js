/** lib/api.ts: qué va al backend (NestJS), con qué token, y que sin NEXT_PUBLIC_API_URL todo siga igual. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const llamadas: Array<{ url: string; auth: string | null }> = [];

beforeEach(() => {
  llamadas.length = 0;
  vi.resetModules();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      llamadas.push({ url, auth: new Headers(init.headers).get("Authorization") });
      return new Response("{}");
    }),
  );
  vi.stubGlobal("Clerk", { loaded: true, session: { getToken: async () => "token-de-clerk" } });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("con NEXT_PUBLIC_API_URL", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:4000/"));

  it.each([
    ["/api/businesses", "http://localhost:4000/businesses"],
    ["/api/businesses?businessId=x", "http://localhost:4000/businesses?businessId=x"],
    ["/api/business/services", "http://localhost:4000/business/services"],
    ["/api/business/stylists/schedule?stylistId=1", "http://localhost:4000/business/stylists/schedule?stylistId=1"],
    ["/api/business/branches", "http://localhost:4000/business/branches"],
    ["/api/files/abc", "http://localhost:4000/files/abc"],
  ])("%s va al backend con el token de Clerk", async (ruta, esperada) => {
    const { api } = await import("@/lib/api");
    await api(ruta, { method: "POST", headers: { "Content-Type": "application/json" } });
    expect(llamadas).toEqual([{ url: esperada, auth: "Bearer token-de-clerk" }]);
  });

  it("si Clerk todavía no termina de cargar, espera y manda el token (no la petición sin token)", async () => {
    const sinCargar: { loaded: boolean; session: null | { getToken: () => Promise<string> } } = { loaded: false, session: null };
    vi.stubGlobal("Clerk", sinCargar);
    setTimeout(() => {
      sinCargar.loaded = true;
      sinCargar.session = { getToken: async () => "token-tardio" };
    }, 120);
    const { api } = await import("@/lib/api");
    await api("/api/business/summary");
    expect(llamadas).toEqual([{ url: "http://localhost:4000/business/summary", auth: "Bearer token-tardio" }]);
  });

  it.each(["/api/client/appointments", "/api/business/appointments", "/api/admin/users", "/api/businessesx"])(
    "%s (aún no movida) sigue yendo a Next.js, sin token",
    async (ruta) => {
      const { api } = await import("@/lib/api");
      await api(ruta);
      expect(llamadas).toEqual([{ url: ruta, auth: null }]);
    },
  );

  it("urlArchivo: /api/files/<id> pasa al backend; las https:// no cambian", async () => {
    const { urlArchivo } = await import("@/lib/api");
    expect(urlArchivo("/api/files/123")).toBe("http://localhost:4000/files/123");
    expect(urlArchivo("https://img.example/a.png")).toBe("https://img.example/a.png");
    expect(urlArchivo(null)).toBeNull();
  });
});

describe("sin NEXT_PUBLIC_API_URL (producción hoy)", () => {
  it("todo sigue yendo a Next.js, sin token, y las URLs de archivos no cambian", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    const { api, urlArchivo } = await import("@/lib/api");
    await api("/api/business/services");
    expect(llamadas).toEqual([{ url: "/api/business/services", auth: null }]);
    expect(urlArchivo("/api/files/123")).toBe("/api/files/123");
  });
});
