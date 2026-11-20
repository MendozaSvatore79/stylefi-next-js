/** Cabeceras de seguridad del front (lib/cabeceras.ts, aplicadas en next.config.ts). */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CACHE_DE_IMAGENES, cabecerasDeSeguridad, politicaDeContenido } from "@/lib/cabeceras";

const BACKEND = "https://api.stylehub.synovasystems.com";
const mapa = () => Object.fromEntries(cabecerasDeSeguridad(BACKEND).map((c) => [c.key, c.value]));

describe("cabecerasDeSeguridad", () => {
  it("HSTS de un año, nosniff y Referrer-Policy", () => {
    const c = mapa();
    expect(c["Strict-Transport-Security"]).toBe("max-age=31536000; includeSubDomains");
    expect(c["X-Content-Type-Options"]).toBe("nosniff");
    expect(c["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("ninguna página se puede incrustar en otra (clickjacking)", () => {
    const c = mapa();
    expect(c["X-Frame-Options"]).toBe("DENY");
    expect(c["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
  });

  it("la CSP completa se aplica (ya no en solo reporte)", () => {
    const c = mapa();
    expect(c["Content-Security-Policy"]).toBe(politicaDeContenido(BACKEND));
    expect(c["Content-Security-Policy-Report-Only"]).toBeUndefined();
  });

  it("Permissions-Policy: sin cámara ni micrófono; ubicación y pago solo para el sitio (y Stripe)", () => {
    const p = mapa()["Permissions-Policy"];
    expect(p).toContain("camera=()");
    expect(p).toContain("microphone=()");
    expect(p).toContain("geolocation=(self)");
    expect(p).toContain('payment=(self "https://js.stripe.com")');
  });
});

describe("politicaDeContenido", () => {
  const csp = politicaDeContenido(`${BACKEND}/`);
  const directiva = (nombre: string) => csp.split("; ").find((d) => d.startsWith(`${nombre} `)) ?? "";

  it("permite hablar con el backend (solo su origen), Clerk y Stripe", () => {
    expect(directiva("connect-src")).toContain(BACKEND);
    expect(directiva("connect-src")).not.toContain(`${BACKEND}/`);
    expect(directiva("connect-src")).toContain("https://clerk.stylehub.synovasystems.com");
    expect(directiva("connect-src")).toContain("https://api.stripe.com");
    expect(directiva("script-src")).toContain("https://js.stripe.com");
    expect(directiva("frame-src")).toContain("https://js.stripe.com");
  });

  it("Clerk Protect: su script y sus sondeos en cualquier puerto (visto en producción el 2026-11-19)", () => {
    expect(directiva("script-src")).toContain("https://cdn.protect.clerk.com");
    expect(directiva("connect-src")).toContain("https://*.protect.clerk.com:*");
  });

  it("imágenes del backend (sucursales) y del propio sitio", () => {
    expect(directiva("img-src")).toContain(BACKEND);
    // Las fotos de la portada se sirven desde el propio sitio (public/estilos), no desde Unsplash
    expect(directiva("img-src")).not.toContain("unsplash");
  });

  it("sin plugins, sin cambiar la base y sin incrustarse", () => {
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });
});

describe("next.config.ts", () => {
  it("aplica las cabeceras a todas las rutas y quita X-Powered-By", () => {
    const fuente = readFileSync(path.resolve(import.meta.dirname, "../next.config.ts"), "utf8");
    expect(fuente).toContain('source: "/:path*", headers: cabecerasDeSeguridad(process.env.NEXT_PUBLIC_API_URL!, origenSentry)');
    expect(fuente).toContain("poweredByHeader: false");
  });

  it("guarda en caché una semana las fotos y logos de public/", () => {
    const fuente = readFileSync(path.resolve(import.meta.dirname, "../next.config.ts"), "utf8");
    expect(fuente).toContain('...["/estilos/:path*", "/brand/:path*"].map((source) => ({');
    expect(fuente).toContain('headers: [{ key: "Cache-Control", value: CACHE_DE_IMAGENES }]');
    expect(CACHE_DE_IMAGENES).toMatch(/^public, max-age=604800\b/);
  });
});
