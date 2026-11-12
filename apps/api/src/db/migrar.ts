// Aplica las migraciones de drizzle/ a DATABASE_URL.
//
//   npm run db:migrar -w @stylefi/api              → aplica las pendientes
//   npm run db:migrar -w @stylefi/api -- --marcar-base
//       → para una base que ya creó la app antigua (ensureStylehubSchema): no cambia ninguna tabla,
//         solo registra la migración 0000 como aplicada. Se niega si la base no está completa o si
//         ya tiene migraciones registradas.
import path from "node:path";
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import postgres from "postgres";

import { leerConfig } from "../config.js";
import { opcionesDeConexion } from "./conexion.js";

export const CARPETA_MIGRACIONES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../drizzle");

/** Tablas y restricción que deben existir para considerar que una base vieja ya está en la versión 0000. */
const TABLAS_BASE = 23;
const RESTRICCION_CLAVE = "stylehub_appointments_no_overlap";

export async function aplicarMigraciones(sql: postgres.Sql) {
  await migrate(drizzle(sql), { migrationsFolder: CARPETA_MIGRACIONES });
}

export async function marcarBase(sql: postgres.Sql) {
  const [{ tablas }] = await sql<{ tablas: number }[]>`
    SELECT count(*)::int AS tablas FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'stylehub\\_%'
  `;
  const [{ restriccion }] = await sql<{ restriccion: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = ${RESTRICCION_CLAVE}) AS restriccion
  `;
  if (tablas !== TABLAS_BASE || !restriccion) {
    throw new Error(`La base no coincide con la versión 0000 (tablas: ${tablas} de ${TABLAS_BASE}, restricción anti-traslape: ${restriccion ? "sí" : "no"}). No se marcó nada.`);
  }
  const [base] = readMigrationFiles({ migrationsFolder: CARPETA_MIGRACIONES });
  await sql.begin(async (tx) => {
    await tx`CREATE SCHEMA IF NOT EXISTS drizzle`;
    await tx`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`;
    const [{ n }] = await tx<{ n: number }[]>`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`;
    if (n > 0) throw new Error("La base ya tiene migraciones registradas. No se marcó nada.");
    await tx`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${base.hash}, ${base.folderMillis})`;
  });
}

async function main() {
  const { databaseUrl } = leerConfig({ PORT: "1", ...process.env });
  const sql = postgres(databaseUrl, { ...opcionesDeConexion(databaseUrl), max: 1 });
  try {
    if (process.argv.includes("--marcar-base")) {
      await marcarBase(sql);
      console.log("Base marcada en la versión 0000 (no se cambió ninguna tabla).");
    } else {
      await aplicarMigraciones(sql);
      console.log("Migraciones al día.");
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
