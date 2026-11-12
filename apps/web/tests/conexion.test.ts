/** Opciones del cliente postgres para Vercel + AWS RDS. */
import { describe, expect, it } from "vitest";

import { opcionesDeConexion } from "@/lib/db";

describe("opcionesDeConexion", () => {
  it("en RDS: pocas conexiones, cierre por inactividad y SSL obligatorio", () => {
    const o = opcionesDeConexion("postgres://app:x@stylefi.abc123.us-east-1.rds.amazonaws.com:5432/stylefi");
    expect(o.max).toBeLessThanOrEqual(2);
    expect(o.idle_timeout).toBeGreaterThan(0);
    expect(o.ssl).toBe("require");
  });

  it("solo en local (Docker) no exige SSL", () => {
    expect(opcionesDeConexion("postgres://u:p@localhost:5432/db").ssl).toBe(false);
    expect(opcionesDeConexion("postgres://u:p@127.0.0.1:5432/db").ssl).toBe(false);
  });

  it("un host que solo empieza como local sigue exigiendo SSL", () => {
    expect(opcionesDeConexion("postgres://u:p@localhost.evil.com/db").ssl).toBe("require");
  });
});
