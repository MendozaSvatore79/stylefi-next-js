import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const leer = (archivo: string) => readFileSync(path.resolve(import.meta.dirname, "..", archivo), "utf8");
const aviso = leer("components/aviso-modulo.tsx");

describe("módulo desactivado o en mantenimiento", () => {
  it.each(["components/client-dashboard-shell.tsx", "components/business-dashboard-shell.tsx"])(
    "%s muestra el aviso EN LUGAR del contenido (no encima)",
    (archivo) => {
      const shell = leer(archivo);
      expect(shell).toMatch(/\{isBlocked \? \(\s*<AvisoModulo titulo=\{moduleAccess\?\.module\?\.title\} razon=\{moduleAccess\?\.reason \?\? null\} \/>\s*\) : \(\s*children\s*\)\}/);
      expect(shell).not.toMatch(/\) : null\}\s*\{children\}/);
      expect(shell).not.toContain("Este módulo está desactivado por administración.");
    },
  );

  it("el aviso va en español e inglés y distingue mantenimiento de desactivado", () => {
    for (const clave of ["module.status", "module.fallback", "module.maintenance", "module.disabled"]) expect(aviso).toContain(`t("${clave}")`);
    expect(aviso).toContain('razon === "maintenance" ? t("module.maintenance") : t("module.disabled")');
    expect(aviso).not.toMatch(/absolute inset-0/);
  });
});
