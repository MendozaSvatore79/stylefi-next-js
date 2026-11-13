/**
 * Guardia sobre el código de las pantallas del grupo 3 (no hay pruebas de componentes en el proyecto).
 * Lo de verdad se verifica en el navegador; esto evita que vuelvan cosas que el backend ya rechaza.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const leer = (archivo: string) => readFileSync(path.resolve(import.meta.dirname, "..", archivo), "utf8");

describe("admin", () => {
  it("el correo se muestra de solo lectura (el backend rechaza cambiarlo)", () => {
    const fuente = leer("app/dashboard/admin/page.tsx");
    expect(fuente).toMatch(/<Input value=\{editUserForm\.email\} readOnly/);
    expect(fuente).not.toContain("email: event.target.value");
    expect(fuente).toContain("El correo lo cambia la persona desde su cuenta.");
  });
});
