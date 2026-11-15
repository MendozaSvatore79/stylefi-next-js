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
    ["/api/client/appointments", "http://localhost:4000/client/appointments"],
    ["/api/client/appointments/availability?date=2026-11-20", "http://localhost:4000/client/appointments/availability?date=2026-11-20"],
    ["/api/client/favorites", "http://localhost:4000/client/favorites"],
    ["/api/client/wallet/recharge/confirm", "http://localhost:4000/client/wallet/recharge/confirm"],
    ["/api/client/wallet/recharges", "http://localhost:4000/client/wallet/recharges"],
    ["/api/client/payment-methods/setup-intent", "http://localhost:4000/client/payment-methods/setup-intent"],
    ["/api/business/appointments", "http://localhost:4000/business/appointments"],
    ["/api/admin/users", "http://localhost:4000/admin/users"],
    ["/api/admin/branch-verifications?status=pending", "http://localhost:4000/admin/branch-verifications?status=pending"],
    ["/api/admin/live-dashboard", "http://localhost:4000/admin/live-dashboard"],
    ["/api/live-dashboard", "http://localhost:4000/live-dashboard"],
    ["/api/live-dashboard/module-access?pathname=%2Fx", "http://localhost:4000/live-dashboard/module-access?pathname=%2Fx"],
    ["/api/onboarding", "http://localhost:4000/onboarding"],
    ["/api/client/onboarding", "http://localhost:4000/client/onboarding"],
    ["/api/sesion", "http://localhost:4000/sesion"],
    ["/api/entrar", "http://localhost:4000/entrar"],
    ["/api/registro/completar", "http://localhost:4000/registro/completar"],
    ["/api/account/security", "http://localhost:4000/account/security"],
    ["/api/geocode/reverse?lat=1&lng=2", "http://localhost:4000/geocode/reverse?lat=1&lng=2"],
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

  it.each(["/api/admin/support-tickets", "/api/support/tickets", "/api/client/walletx", "/api/admin/usersx", "/api/businessesx"])(
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

describe("apiServidor (páginas que se arman en el servidor)", () => {
  beforeEach(() => {
    vi.doMock("@clerk/nextjs/server", () => ({
      auth: async () => ({ getToken: async () => "token-del-servidor" }),
    }));
  });
  afterEach(() => {
    vi.doUnmock("@clerk/nextjs/server");
  });

  it("con NEXT_PUBLIC_API_URL: llama al backend con el token de Clerk de la petición y sin caché", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:4000");
    const espia = vi.fn(async (_url: string, _init: RequestInit = {}) => new Response("{}"));
    vi.stubGlobal("fetch", espia);
    const { apiServidor } = await import("@/lib/api-servidor");
    const r = await apiServidor("/entrar");
    expect(r).toBeInstanceOf(Response);
    const [url, init = {}] = espia.mock.calls[0];
    expect(url).toBe("http://localhost:4000/entrar");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token-del-servidor");
    expect(init.cache).toBe("no-store");
  });

  it("sin NEXT_PUBLIC_API_URL: null (quien llama sigue usando la base)", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    const { apiServidor } = await import("@/lib/api-servidor");
    expect(await apiServidor("/entrar")).toBeNull();
    expect(llamadas).toEqual([]);
  });
});
