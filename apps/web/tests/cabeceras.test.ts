/** Cabeceras de seguridad del front (lib/cabeceras.ts, aplicadas en next.config.ts). */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { cabecerasDeSeguridad, politicaDeContenido } from "@/lib/cabeceras";

const BACKEND = "https://api.stylehub.synovasystems.com";
const mapa = () => Object.fromEntries(cabecerasDeSeguridad(BACKEND).map((c) => [c.key, c.value]));

describe("cabecerasDeSeguridad", () => {
  it("HSTS de un año, nosniff y Referrer-Policy", () => {
    const c = mapa();
    expect(c["Strict-Transport-Security"]).toBe("max-age=31536000; includeSubDomains");
    expect(c["X-Content-Type-Options"]).toBe("nosniff");
    expect(c["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("ninguna página se puede incrustar en otra (clickjacking), y eso sí se aplica", () => {
    const c = mapa();
    expect(c["X-Frame-Options"]).toBe("DENY");
    expect(c["Content-Security-Policy"]).toBe("frame-ancestors 'none'");
  });

  it("la CSP completa va en solo reporte (no bloquea mientras se revisa)", () => {
    const c = mapa();
    expect(c["Content-Security-Policy-Report-Only"]).toBe(politicaDeContenido(BACKEND));
    expect(c["Content-Security-Policy"]).not.toContain("script-src");
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

  it("imágenes del backend (sucursales) y de la portada", () => {
    expect(directiva("img-src")).toContain(BACKEND);
    expect(directiva("img-src")).toContain("https://images.unsplash.com");
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
    expect(fuente).toContain('source: "/:path*", headers: cabecerasDeSeguridad(process.env.NEXT_PUBLIC_API_URL!)');
    expect(fuente).toContain("poweredByHeader: false");
  });
});
