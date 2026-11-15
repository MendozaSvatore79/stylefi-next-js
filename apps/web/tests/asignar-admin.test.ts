/** npm run asignar-admin: el rol de administración solo se da desde la terminal, y nunca a un cliente o negocio. */
import { describe, expect, it } from "vitest";

import { asignarAdmin } from "@/scripts/asignar-admin.mjs";

import { crearFakeDb } from "./fake-db";

describe("npm run asignar-admin", () => {
  it("crea una cuenta de administración sin contraseña, con el correo normalizado", async () => {
    const { sql, queries } = crearFakeDb();
    expect(await asignarAdmin(sql, { email: " Jefa@Test.MX ", nombre: "Jefa" })).toBe("creada");
    const alta = queries.find((q) => q.text.startsWith("INSERT INTO stylehub_users"))!;
    expect(alta.text).toContain("'admin'");
    expect(alta.text).not.toMatch(/password/);
    expect(alta.values).toContain("jefa@test.mx");
  });

  it("si ya es de administración, no cambia nada", async () => {
    const { sql, queries } = crearFakeDb((q) => (q.text.startsWith("SELECT") ? [{ id: "a1", account_type: "admin" }] : []));
    expect(await asignarAdmin(sql, { email: "jefa@test.mx" })).toBe("ya-era-admin");
    expect(queries.some((q) => q.text.startsWith("INSERT") || q.text.startsWith("UPDATE"))).toBe(false);
  });

  it.each(["cliente", "negocio"])("no convierte en administración una cuenta de %s", async (tipo) => {
    const { sql, queries } = crearFakeDb((q) => (q.text.startsWith("SELECT") ? [{ id: "u1", account_type: tipo }] : []));
    await expect(asignarAdmin(sql, { email: "n@test.mx" })).rejects.toThrow(tipo);
    expect(queries.some((q) => q.text.startsWith("INSERT") || q.text.startsWith("UPDATE"))).toBe(false);
  });

  it("rechaza un correo inválido sin consultar la base", async () => {
    const { sql, queries } = crearFakeDb();
    await expect(asignarAdmin(sql, { email: "no-es-correo" })).rejects.toThrow("inválido");
    expect(queries).toHaveLength(0);
  });
});
