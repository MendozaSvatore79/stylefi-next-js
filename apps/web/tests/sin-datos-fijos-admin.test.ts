import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// Sin comentarios: el que explica el cambio menciona lo que se quitó
const shellAdmin = readFileSync(path.resolve(import.meta.dirname, "..", "components/admin-dashboard-shell.tsx"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

describe("panel admin sin indicadores fijos", () => {
  it("ya no tiene «Estado global: Operativo» ni el botón «Alertas»", () => {
    expect(shellAdmin).not.toMatch(/estadoGlobal|operativo|monitoreo|alertas|<Bell/);
    expect(shellAdmin).not.toMatch(/Operativo|Operational|Alertas|Alerts/);
  });
});
