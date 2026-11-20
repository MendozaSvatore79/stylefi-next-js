/**
 * Estado derivado sin setState en un efecto (regla react-hooks/set-state-in-effect). Los archivos ya corregidos no
 * deben volver a tener el aviso; la regla sigue en "warn" mientras queden cargas de datos por migrar.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const RAIZ = path.resolve(import.meta.dirname, "..");
const leer = (archivo: string) => readFileSync(path.resolve(RAIZ, archivo), "utf8");

const CORREGIDOS = [
  "components/admin-dashboard-shell.tsx",
  "components/business-dashboard-shell.tsx",
  "components/client-dashboard-shell.tsx",
];

describe("sin setState en efectos", () => {
  it("los archivos corregidos no tienen el aviso", async () => {
    const resultados = await new ESLint({ cwd: RAIZ }).lintFiles(CORREGIDOS);
    const avisos = resultados.flatMap((r) =>
      r.messages
        .filter((m) => m.ruleId === "react-hooks/set-state-in-effect")
        .map((m) => `${path.relative(RAIZ, r.filePath)}:${m.line}`),
    );
    expect(avisos).toEqual([]);
  }, 60_000);
});

describe("menú del avatar en los paneles", () => {
  it.each(["admin", "business", "client"])("%s: se cierra al cambiar de ruta porque recuerda dónde se abrió", (panel) => {
    const fuente = leer(`components/${panel}-dashboard-shell.tsx`);
    expect(fuente).toContain("const avatarMenuOpen = menuAbiertoEn === pathname;");
    expect(fuente).toContain("setMenuAbiertoEn((abiertoEn) => (abiertoEn === pathname ? null : pathname))");
  });
});
