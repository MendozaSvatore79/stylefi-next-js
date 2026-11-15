/** /registro no es una página (solo existe /registro/completar): los enlaces de registro van a /register. */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const leer = (archivo: string) => readFileSync(path.resolve(import.meta.dirname, "..", archivo), "utf8");

describe("enlaces de registro de la portada", () => {
  it('ningún enlace apunta a /registro (con o sin parámetros); "Conócenos" de negocios va a /register', () => {
    const portada = leer("app/page.tsx");
    expect(portada).not.toMatch(/href=["'`{]+\/registro(?!\/completar)/);
    const conocenos = portada.match(/<Link\s+href="([^"]+)"[^>]*>\s*Conócenos/);
    expect(conocenos?.[1]).toBe("/register");
  });
});
