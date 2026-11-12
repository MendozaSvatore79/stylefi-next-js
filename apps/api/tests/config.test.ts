/** Configuración del API y opciones de conexión a la base. */
import { describe, expect, it } from "vitest";

import { leerConfig } from "../src/config.js";
import { opcionesDeConexion } from "../src/db/conexion.js";

describe("leerConfig", () => {
  it("exige DATABASE_URL", () => {
    expect(() => leerConfig({})).toThrow(/DATABASE_URL/);
  });

  it("puerto 4000 y front en localhost:3000 por defecto", () => {
    expect(leerConfig({ DATABASE_URL: "postgres://x" })).toEqual({ databaseUrl: "postgres://x", port: 4000, webOrigin: "http://localhost:3000" });
  });

  it("rechaza un puerto inválido", () => {
    expect(() => leerConfig({ DATABASE_URL: "postgres://x", PORT: "abc" })).toThrow(/PORT/);
  });
});

describe("opcionesDeConexion", () => {
  it("en RDS: pool de 10, cierre por inactividad y SSL obligatorio", () => {
    const o = opcionesDeConexion("postgres://app:x@stylefi.abc.us-east-1.rds.amazonaws.com:5432/stylefi");
    expect(o.max).toBe(10);
    expect(o.idle_timeout).toBeGreaterThan(0);
    expect(o.ssl).toBe("require");
  });

  it("sin SSL solo en local o dentro de Docker", () => {
    expect(opcionesDeConexion("postgres://u:p@127.0.0.1:54329/db").ssl).toBe(false);
    expect(opcionesDeConexion("postgres://u:p@postgres:5432/db").ssl).toBe(false);
    expect(opcionesDeConexion("postgres://u:p@localhost.evil.com/db").ssl).toBe("require");
  });
});
