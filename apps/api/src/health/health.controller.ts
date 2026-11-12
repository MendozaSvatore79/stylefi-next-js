import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";

import { SQL, type Sql } from "../db/db.module.js";

const LIMITE_MS = 2000;

/** Lo consulta el balanceador de AWS: 200 si el API responde y la base contesta, 503 si no. */
@Controller("health")
export class HealthController {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  @Get()
  async revisar() {
    let temporizador: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.sql`SELECT 1`,
        new Promise((_, rechazar) => {
          temporizador = setTimeout(() => rechazar(new Error("sin respuesta")), LIMITE_MS);
        }),
      ]);
      return { estado: "ok", base: "ok" };
    } catch {
      throw new ServiceUnavailableException({ estado: "error", base: "sin conexión" });
    } finally {
      clearTimeout(temporizador);
    }
  }
}
