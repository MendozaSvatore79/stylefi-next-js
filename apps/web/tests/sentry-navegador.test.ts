/** Errores del navegador a Sentry: apagado sin DSN, sin datos personales y permitido en la CSP. */
import { readFileSync } from "node:fs";
import path from "node:path";

import type { ErrorEvent } from "@sentry/browser";
import { describe, expect, it } from "vitest";

import { politicaDeContenido } from "@/lib/cabeceras";
import { limpiarEvento } from "@/lib/sentry-limpieza";
import { opcionesSentryNavegador, origenDeSentry } from "@/lib/sentry-navegador";

const DSN = "https://abc123@o450.ingest.us.sentry.io/4500";
const leer = (archivo: string) => readFileSync(path.resolve(import.meta.dirname, "..", archivo), "utf8");

describe("opcionesSentryNavegador", () => {
  it("sin DSN queda apagado", () => {
    expect(opcionesSentryNavegador({}).enabled).toBe(false);
    expect(opcionesSentryNavegador({ NEXT_PUBLIC_SENTRY_DSN: "  " }).enabled).toBe(false);
  });

  it("con DSN: solo errores, sin datos personales por omisión", () => {
    const o = opcionesSentryNavegador({ NEXT_PUBLIC_SENTRY_DSN: ` ${DSN} `, NODE_ENV: "production" });
    expect(o).toMatchObject({ dsn: DSN, enabled: true, environment: "production", tracesSampleRate: 0 });
    expect(o.dataCollection).toEqual({ userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false });
    expect(o).not.toHaveProperty("replaysSessionSampleRate");
  });
});

describe("limpiarEvento (común)", () => {
  it("quita usuario, cookies, cabeceras y query de la página y de las migas", () => {
    const evento = {
      type: undefined,
      user: { id: "user_1", email: "a@b.mx" },
      request: {
        url: "https://stylehub.synovasystems.com/sign-in?__clerk_ticket=secreto#x",
        cookies: { __session: "s" },
        headers: { Authorization: "Bearer t" },
        query_string: "__clerk_ticket=secreto",
      },
      breadcrumbs: [
        { category: "fetch", data: { url: "https://api.x/citas?token=1", method: "GET" } },
        { category: "navigation", data: { from: "/a?b=1", to: "/c#d" } },
      ],
    } as unknown as ErrorEvent;
    const limpio = limpiarEvento(evento);
    expect(limpio.user).toBeUndefined();
    expect(limpio.request).toEqual({ url: "https://stylehub.synovasystems.com/sign-in" });
    expect(limpio.breadcrumbs?.[0].data).toEqual({ url: "https://api.x/citas", method: "GET" });
    expect(limpio.breadcrumbs?.[1].data).toEqual({ from: "/a", to: "/c" });
    expect(JSON.stringify(limpio)).not.toMatch(/secreto|user_1|Bearer|token=/);
  });

  it("es el beforeSend de las opciones", () => {
    const beforeSend = opcionesSentryNavegador({ NEXT_PUBLIC_SENTRY_DSN: DSN }).beforeSend!;
    const r = beforeSend({ type: undefined, user: { id: "u" } } as ErrorEvent, {}) as ErrorEvent;
    expect(r.user).toBeUndefined();
  });
});

describe("CSP", () => {
  it("permite el origen del DSN en connect-src solo si hay DSN", () => {
    expect(origenDeSentry(DSN)).toBe("https://o450.ingest.us.sentry.io");
    expect(origenDeSentry("no es url")).toBeNull();
    expect(origenDeSentry(undefined)).toBeNull();
    const conexion = (csp: string) => csp.split("; ").find((d) => d.startsWith("connect-src "))!;
    expect(conexion(politicaDeContenido("https://api.x", origenDeSentry(DSN)))).toMatch(/ https:\/\/o450\.ingest\.us\.sentry\.io$/);
    expect(conexion(politicaDeContenido("https://api.x"))).not.toMatch(/sentry/);
  });
});

describe("conexión con la app", () => {
  it("instrumentation-client inicia Sentry con la variable escrita completa (Next la inyecta al compilar)", () => {
    const fuente = leer("instrumentation-client.ts");
    expect(fuente).toContain("Sentry.init(");
    expect(fuente).toContain("NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN");
  });

  it("las pantallas de error reportan lo que atrapan", () => {
    for (const archivo of ["app/error.tsx", "app/global-error.tsx"]) {
      expect(leer(archivo)).toMatch(/useEffect\(\(\) => \{\s+captureException\(error\);\s+\}, \[error\]\);/);
    }
  });

  it("next.config pasa el origen de Sentry a las cabeceras", () => {
    expect(leer("next.config.ts")).toContain("const origenSentry = origenDeSentry(dsnDeSentry(process.env));");
  });

  it("lo que importa next.config usa rutas relativas (su cargador no resuelve el alias @/)", () => {
    for (const archivo of ["lib/sentry-navegador.ts", "lib/sentry-limpieza.ts"]) {
      expect(leer(archivo)).not.toMatch(/from "@\//);
    }
  });
});
