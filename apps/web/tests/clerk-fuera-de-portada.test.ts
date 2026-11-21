/** Clerk solo en app/(con-sesion): la portada, términos, privacidad y las páginas de error no lo descargan. */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const RAIZ = path.resolve(import.meta.dirname, "..");
const leer = (archivo: string) => readFileSync(path.resolve(RAIZ, archivo), "utf8");

/** Archivos alcanzables por import desde `inicio` (alias @/ y rutas relativas), sin node_modules ni `import type`. */
function alcanzables(inicio: string) {
  const vistos = new Set<string>();
  const resolver = (desde: string, spec: string) => {
    const base = spec.startsWith("@/") ? path.resolve(RAIZ, spec.slice(2)) : path.resolve(path.dirname(desde), spec);
    for (const ext of ["", ".tsx", ".ts", "/index.tsx", "/index.ts"]) if (existsSync(base + ext) && !base.endsWith("/") && (ext || /\.(tsx?|css)$/.test(base))) return base + ext;
    return null;
  };
  const visitar = (archivo: string) => {
    if (vistos.has(archivo) || !/\.tsx?$/.test(archivo)) return;
    vistos.add(archivo);
    for (const m of readFileSync(archivo, "utf8").matchAll(/(?:import|export)(?!\s+type\b)[^"']*?from\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g)) {
      const spec = m[1] ?? m[2];
      if (spec.startsWith("@/") || spec.startsWith(".")) {
        const r = resolver(archivo, spec);
        if (r) visitar(r);
      }
    }
  };
  visitar(path.resolve(RAIZ, inicio));
  return [...vistos];
}

describe("páginas públicas sin Clerk", () => {
  it.each(["app/layout.tsx", "app/page.tsx", "app/terms-of-service/page.tsx", "app/privacy-policy/page.tsx", "app/not-found.tsx", "app/error.tsx", "app/global-error.tsx"])(
    "%s no llega a @clerk por ningún import",
    (inicio) => {
      const conClerk = alcanzables(inicio).filter((f) => /from\s+["']@clerk\//.test(readFileSync(f, "utf8"))).map((f) => path.relative(RAIZ, f));
      expect(conClerk).toEqual([]);
    },
  );

  it("el recorrido de imports sí encuentra Clerk desde el grupo con sesión (la prueba de arriba no pasa en falso)", () => {
    const desdeGrupo = alcanzables("app/(con-sesion)/layout.tsx").map((f) => path.relative(RAIZ, f));
    expect(desdeGrupo).toEqual(expect.arrayContaining(["app/(con-sesion)/con-sesion.tsx", "lib/sesion-cliente.tsx", "components/oracle-support-widget.tsx"]));
    expect(leer("app/(con-sesion)/layout.tsx")).toContain('import { ClerkProvider } from "@clerk/nextjs";');
  });

  it("la portada monta AURA como visitante; el grupo con sesión, con la sesión de Clerk", () => {
    expect(leer("app/page.tsx")).toContain("<AuraSinSesion />");
    expect(leer("components/aura-sin-sesion.tsx")).toMatch(/<SesionAnonima>\s+<OracleSupportWidget \/>\s+<\/SesionAnonima>/);
    expect(leer("app/(con-sesion)/con-sesion.tsx")).toMatch(/marcarPaginaConClerk\(\);\s+return \(\s+<SesionProvider>\s+\{children\}\s+<OracleSupportWidget \/>/);
    expect(leer("app/providers.tsx")).not.toMatch(/OracleSupportWidget|SesionProvider|@clerk/);
  });

  it("AURA sin sesión no muestra ni borra un ticket de cuenta (sin código); sí el de visitante (con código)", () => {
    const widget = leer("components/oracle-support-widget.tsx");
    expect(widget).toContain(
      'const ticketDeUnaCuenta = status === "unauthenticated" && ticketElegido === undefined && ticketGuardado !== null && !llaveGuardada;',
    );
    expect(widget).toContain("const ticketId = ticketElegido === undefined ? (ticketDeUnaCuenta ? null : ticketGuardado) : ticketElegido;");
  });
});

describe("api(): el token de Clerk solo se espera donde hay Clerk", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
    delete (globalThis as { Clerk?: unknown }).Clerk;
  });

  const cargar = async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.prueba.invalid");
    const pedidos: { url: string; auth: string | null }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      pedidos.push({ url, auth: new Headers(init.headers).get("Authorization") });
      return new Response("{}", { status: 200 });
    });
    const modulo = await import("@/lib/api");
    return { ...modulo, pedidos };
  };

  it("sin la marca del grupo con sesión y sin Clerk, sale enseguida y sin token (antes esperaba 10 s)", async () => {
    const { api, pedidos } = await cargar();
    const inicio = Date.now();
    await api("/api/live-dashboard");
    expect(Date.now() - inicio).toBeLessThan(1000);
    expect(pedidos).toEqual([{ url: "https://api.prueba.invalid/live-dashboard", auth: null }]);
  });

  it("con la marca, espera a Clerk y manda su token", async () => {
    const { api, marcarPaginaConClerk, pedidos } = await cargar();
    marcarPaginaConClerk();
    setTimeout(() => {
      (globalThis as { Clerk?: unknown }).Clerk = { loaded: true, session: { getToken: async () => "tok-prueba" } };
    }, 200);
    await api("/api/client/appointments");
    expect(pedidos).toEqual([{ url: "https://api.prueba.invalid/client/appointments", auth: "Bearer tok-prueba" }]);
  });
});
