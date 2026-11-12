import { describe, expect, it } from "vitest";

import { verifyPassword } from "@/lib/password";
import { crearAdmin, generarPassword, hashPassword } from "@/scripts/crear-admin.mjs";

import { crearFakeDb } from "./fake-db";

describe("npm run crear-admin", () => {
  it("el hash del script lo acepta lib/password (mismo formato scrypt)", () => {
    const hash = hashPassword("una-clave-segura");
    expect(verifyPassword("una-clave-segura", hash)).toBe(true);
    expect(verifyPassword("otra", hash)).toBe(false);
  });

  it("crea la cuenta con tipo admin y el correo verificado", async () => {
    const { sql, queries } = crearFakeDb();
    expect(await crearAdmin(sql, { email: " Jefa@Test.MX ", nombre: "Jefa", password: "clave-de-12-caracteres" })).toBe("creada");
    const insert = queries.find((q) => q.text.startsWith("INSERT INTO stylehub_users"))!;
    expect(insert.text).toContain("'admin'");
    expect(insert.text).toMatch(/email_verified/);
    expect(insert.values).toContain("jefa@test.mx");
    expect(verifyPassword("clave-de-12-caracteres", insert.values[2] as string)).toBe(true);
  });

  it("no convierte en administración una cuenta de cliente o negocio", async () => {
    const { sql, queries } = crearFakeDb((q) => (q.text.startsWith("SELECT") ? [{ id: "u1", account_type: "negocio" }] : []));
    await expect(crearAdmin(sql, { email: "n@test.mx", password: "clave-de-12-caracteres" })).rejects.toThrow("negocio");
    expect(queries.some((q) => q.text.startsWith("INSERT") || q.text.startsWith("UPDATE"))).toBe(false);
  });

  it("si ya es de administración, solo le pone contraseña nueva", async () => {
    const { sql, queries } = crearFakeDb((q) => (q.text.startsWith("SELECT") ? [{ id: "a1", account_type: "admin" }] : []));
    expect(await crearAdmin(sql, { email: "a@test.mx", password: "clave-de-12-caracteres" })).toBe("actualizada");
    expect(queries.some((q) => q.text.startsWith("UPDATE stylehub_users"))).toBe(true);
  });

  it.each([["", "clave-de-12-caracteres"], ["no-es-correo", "clave-de-12-caracteres"], ["a@test.mx", "corta"]])(
    "rechaza correo %j o contraseña corta",
    async (email, password) => {
      const { sql } = crearFakeDb();
      await expect(crearAdmin(sql, { email, password })).rejects.toThrow();
    },
  );

  it("la contraseña generada es larga", () => {
    expect(generarPassword().length).toBeGreaterThanOrEqual(20);
  });
});
