/** CI del front: corre en cada PR, sin secretos, con lint, pruebas y build. */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const raiz = path.resolve(import.meta.dirname, "../../..");
const ci = readFileSync(path.join(raiz, ".github/workflows/ci.yml"), "utf8");

describe("CI", () => {
  it("corre en los PR a main y en los push a main", () => {
    expect(ci).toMatch(/on:\n  pull_request:\n    branches:\n      - main\n  push:\n    branches:\n      - main/);
  });

  it("lint, pruebas y build, en ese orden", () => {
    const pasos = ["npm ci", "npm run build -w @stylefi/shared", "npm run lint", "npm test", "npm run build"].map((p) =>
      ci.indexOf(`- run: ${p}\n`),
    );
    expect(pasos.every((i) => i > -1)).toBe(true);
    expect([...pasos].sort((a, b) => a - b)).toEqual(pasos);
  });

  it("no usa secretos del repositorio ni puede escribir", () => {
    expect(ci).not.toContain("secrets.");
    expect(ci).toMatch(/permissions:\n  contents: read/);
  });

  it("Dependabot semanal para npm y acciones", () => {
    const dependabot = readFileSync(path.join(raiz, ".github/dependabot.yml"), "utf8");
    expect(dependabot).toContain("package-ecosystem: npm");
    expect(dependabot).toContain("package-ecosystem: github-actions");
  });
});
