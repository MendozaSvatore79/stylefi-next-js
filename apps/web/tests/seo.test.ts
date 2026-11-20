/** robots.txt, sitemap y vista previa al compartir. */
import { describe, expect, it } from "vitest";

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { DESCRIPCION_SITIO, SITIO } from "@/lib/sitio";

describe("robots.txt", () => {
  it("deja indexar lo público y apunta al sitemap", () => {
    const r = robots();
    expect(r.sitemap).toBe(`${SITIO}/sitemap.xml`);
    expect(r.rules).toMatchObject({ userAgent: "*", allow: "/" });
  });

  it("no indexa paneles, sesión ni registro a medias", () => {
    const { disallow } = robots().rules as { disallow: string[] };
    for (const r of ["/dashboard/", "/entrar", "/registro/", "/cuenta-suspendida"]) expect(disallow).toContain(r);
  });
});

describe("sitemap", () => {
  it("solo páginas públicas, con la URL completa del sitio", () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls).toEqual([
      SITIO,
      `${SITIO}/register`,
      `${SITIO}/iniciar-sesion`,
      `${SITIO}/terms-of-service`,
      `${SITIO}/privacy-policy`,
    ]);
    expect(urls.some((u) => u.includes("/dashboard"))).toBe(false);
  });
});

describe("datos del sitio", () => {
  it("dominio de producción y descripción real", () => {
    expect(SITIO).toBe("https://stylehub.synovasystems.com");
    expect(DESCRIPCION_SITIO).not.toMatch(/Generated|Synova Tech/);
  });
});
