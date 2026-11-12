import { Global, Inject, Module, type OnApplicationShutdown } from "@nestjs/common";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { leerConfig } from "../config.js";
import { opcionesDeConexion } from "./conexion.js";

/** Cliente postgres (SQL a mano: motor de reservas, candados). */
export const SQL = Symbol("SQL");
/** Drizzle sobre el mismo cliente (consultas con tipos). */
export const DB = Symbol("DB");

export type Sql = postgres.Sql;
export type Db = PostgresJsDatabase;

@Global()
@Module({
  providers: [
    {
      provide: SQL,
      useFactory: () => {
        const { databaseUrl } = leerConfig();
        return postgres(databaseUrl, opcionesDeConexion(databaseUrl));
      },
    },
    { provide: DB, inject: [SQL], useFactory: (sql: Sql) => drizzle(sql) },
  ],
  exports: [SQL, DB],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  async onApplicationShutdown() {
    await this.sql.end({ timeout: 5 });
  }
}
