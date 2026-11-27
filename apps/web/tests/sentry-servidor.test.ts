/** Errores del servidor y edge del front a Sentry: apagado sin SENTRY_DSN, sin datos personales y conectado a Next. */
import { readFileSync } from "node:fs";
import path from "node:path";

import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";

import { limpiarEvento, tacharTexto } from "@/lib/sentry-limpieza";
import { opcionesSentryServidor } from "@/lib/sentry-servidor";

const DSN = "https://abc123@o450.ingest.us.sentry.io/4500";
const leer = (archivo: string) => readFileSync(path.resolve(import.meta.dirname, "..", archivo), "utf8");

describe("opcionesSentryServidor", () => {
  it("sin SENTRY_DSN queda apagado", () => {
    expect(opcionesSentryServidor({}).enabled).toBe(false);
    expect(opcionesSentryServidor({ SENTRY_DSN: "   " })).toMatchObject({ dsn: undefined, enabled: false });
  });

  it("no usa el DSN del navegador: solo la variable de servidor", () => {
    const env = { NEXT_PUBLIC_SENTRY_DSN: DSN } as Record<string, string>;
    expect(opcionesSentryServidor(env).enabled).toBe(false);
  });

  it("con DSN: solo errores y sin datos personales", () => {
    const o = opcionesSentryServidor({ SENTRY_DSN: ` ${DSN} `, NODE_ENV: "production" });
    expect(o).toMatchObject({ dsn: DSN, enabled: true, environment: "production", tracesSampleRate: 0 });
    expect(o.dataCollection).toEqual({ userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false });
  });

  it("su beforeSend es la limpieza común", () => {
    const r = opcionesSentryServidor({ SENTRY_DSN: DSN }).beforeSend({
      type: undefined,
      user: { id: "u" },
      request: { headers: { cookie: "__session=s" } },
    } as ErrorEvent);
    expect(r.user).toBeUndefined();
    expect(r.request).toEqual({});
  });
});

describe("limpiarEvento con eventos del servidor", () => {
  it("quita cabeceras (Authorization, cookie de Clerk), cuerpo, variables de entorno y query de la transacción", () => {
    const evento = {
      type: undefined,
      transaction: "GET /dashboard/cliente?__clerk_ticket=secreto",
      request: {
        url: "https://stylehub.synovasystems.com/dashboard/cliente?__clerk_ticket=secreto",
        method: "GET",
        headers: { authorization: "Bearer t", cookie: "__session=s", "x-forwarded-for": "1.2.3.4" },
        data: { telefono: "5512345678" },
        env: { REMOTE_ADDR: "1.2.3.4" },
      },
    } as unknown as ErrorEvent;
    const limpio = limpiarEvento(evento);
    expect(limpio.request).toEqual({ url: "https://stylehub.synovasystems.com/dashboard/cliente", method: "GET" });
    expect(limpio.transaction).toBe("GET /dashboard/cliente");
    expect(JSON.stringify(limpio)).not.toMatch(/secreto|Bearer|__session|1\.2\.3\.4|5512345678/);
  });
});

describe("tacharTexto (mismas reglas que el backend)", () => {
  it("tacha correos, teléfonos, RFC, Bearer, JWT y llaves secretas", () => {
    const texto =
      "ana@ejemplo.mx llamó al +52 55 1234 5678, RFC GODE561231GR8, Bearer abc.def, eyJhbGciOi.eyJzdWIi.firma, sk_live_123abc";
    expect(tacharTexto(texto)).toBe(
      "[correo] llamó al [teléfono], RFC [rfc], Bearer [filtrado], [token], [llave]",
    );
  });

  it("tacha los secretos antes que los teléfonos (un token de solo dígitos no queda a medias)", () => {
    expect(tacharTexto("Bearer 1234567890")).toBe("Bearer [filtrado]");
  });

  it("quita la query y el fragmento de las URL dentro de cualquier texto (absolutas y rutas)", () => {
    expect(tacharTexto("falló https://stylehub.synovasystems.com/sign-in?__clerk_ticket=secreto#x al entrar")).toBe(
      "falló https://stylehub.synovasystems.com/sign-in al entrar",
    );
    expect(tacharTexto('redirige a "/registro/completar?__clerk_ticket=secreto" (302)')).toBe('redirige a "/registro/completar" (302)');
    expect(tacharTexto("GET /dashboard/cliente?token=abc")).toBe("GET /dashboard/cliente");
  });

  it("no toca textos sin datos personales (archivos con hash, códigos HTTP)", () => {
    expect(tacharTexto("chunks/0un11yv5o19-y.js respondió 500")).toBe("chunks/0un11yv5o19-y.js respondió 500");
  });

  it("limpiarEvento tacha el mensaje del error, las migas de consola y los campos con nombre sensible", () => {
    const evento = {
      type: undefined,
      exception: { values: [{ type: "Error", value: "fallo con ana@ejemplo.mx" }] },
      breadcrumbs: [{ category: "console", message: "tel 5512345678", data: { arguments: ["ana@ejemplo.mx"] } }],
      extra: { token: "abc", contraseña: "x", nota: "ok" },
    } as unknown as ErrorEvent;
    const limpio = limpiarEvento(evento);
    expect(limpio.exception?.values?.[0].value).toBe("fallo con [correo]");
    expect(limpio.breadcrumbs?.[0]).toMatchObject({ message: "tel [teléfono]", data: { arguments: ["[correo]"] } });
    expect(limpio.extra).toEqual({ token: "[filtrado]", contraseña: "[filtrado]", nota: "ok" });
  });

  it("tacha los campos de teléfono aunque el valor sea un número", () => {
    const evento = {
      type: undefined,
      extra: { phone: 5512345678, telefono: 5512345678, teléfono: "x", celular: 5512345678, citas: 3 },
      exception: { values: [{ type: "Error", value: "ver https://api.x/citas?correo=ana@ejemplo.mx" }] },
    } as unknown as ErrorEvent;
    const limpio = limpiarEvento(evento);
    expect(limpio.extra).toEqual({ phone: "[filtrado]", telefono: "[filtrado]", teléfono: "[filtrado]", celular: "[filtrado]", citas: 3 });
    expect(limpio.exception?.values?.[0].value).toBe("ver https://api.x/citas");
  });
});

describe("conexión con Next", () => {
  it("instrumentation.ts carga la configuración de cada runtime y reporta los errores de petición", () => {
    const fuente = leer("instrumentation.ts");
    expect(fuente).toContain('if (process.env.NEXT_RUNTIME === "nodejs") await import("./sentry.server.config");');
    expect(fuente).toContain('if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config");');
    expect(fuente).toMatch(/export const onRequestError: Instrumentation\.onRequestError = [\s\S]*captureRequestError\(error, peticion, contexto\)/);
  });

  it("server y edge inician con SENTRY_DSN y nunca rompen la app", () => {
    for (const archivo of ["sentry.server.config.ts", "sentry.edge.config.ts"]) {
      const fuente = leer(archivo);
      expect(fuente).toContain(
        'Sentry.init(opcionesSentryServidor({ SENTRY_DSN: getOptionalEnv("SENTRY_DSN"), NODE_ENV: getOptionalEnv("NODE_ENV") }));',
      );
      expect(fuente).not.toContain("process.env");
      expect(fuente).toMatch(/try \{[\s\S]*Sentry\.init[\s\S]*\} catch \(error\) \{/);
      // El fallo se ve en los logs, pero sin el mensaje (puede traer el DSN)
      expect(fuente).toMatch(/console\.warn\("Sentry \((servidor|edge)\) no se pudo iniciar:", error instanceof Error \? error\.name : "error desconocido"\);/);
      expect(fuente).not.toMatch(/error\.message|String\(error\)/);
    }
  });

  it("el navegador usa @sentry/browser (la portada pesaba +50 KB con @sentry/nextjs) y el servidor @sentry/nextjs", () => {
    const paquete = JSON.parse(leer("package.json")) as { dependencies: Record<string, string> };
    expect(paquete.dependencies["@sentry/nextjs"]).toMatch(/^\^11\./);
    expect(paquete.dependencies["@sentry/browser"]).toBe(paquete.dependencies["@sentry/nextjs"]);
    for (const archivo of ["instrumentation-client.ts", "app/error.tsx", "app/global-error.tsx", "lib/sentry-navegador.ts", "lib/sentry-limpieza.ts"]) {
      expect(leer(archivo)).not.toContain("@sentry/nextjs");
    }
    for (const archivo of ["instrumentation.ts", "sentry.server.config.ts", "sentry.edge.config.ts"]) {
      expect(leer(archivo)).toContain('from "@sentry/nextjs"');
    }
  });

  it("Amplify pasa SENTRY_DSN al servidor en ejecución (solo esa variable, no cualquiera que la contenga)", () => {
    const amplify = readFileSync(path.resolve(import.meta.dirname, "../../..", "amplify.yml"), "utf8");
    expect(amplify).toContain("- env | grep -e CLERK_SECRET_KEY -e NEXT_PUBLIC_ -e '^SENTRY_DSN=' >> .env.production");
  });

  it("el DSN del servidor no se expone al navegador", () => {
    for (const archivo of ["instrumentation-client.ts", "lib/sentry-navegador.ts", "next.config.ts"]) {
      expect(leer(archivo)).not.toMatch(/(?<!NEXT_PUBLIC_)SENTRY_DSN/);
    }
  });
});
