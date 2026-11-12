import postgres from "postgres";

import { requireEnv } from "@/lib/env";

/** Hosts locales (PostgreSQL en Docker para pruebas): el único caso en que no se exige SSL. */
const HOSTS_LOCALES = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * Opciones de conexión para Vercel (funciones sin servidor) contra PostgreSQL en AWS RDS:
 * pocas conexiones por instancia, se cierran al quedar inactivas, y SSL obligatorio fuera de local.
 */
export function opcionesDeConexion(url: string): postgres.Options<Record<string, never>> {
  const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
  return {
    max: 2,
    idle_timeout: 20, // segundos
    connect_timeout: 10, // segundos
    ssl: HOSTS_LOCALES.has(host) ? false : "require",
  };
}

let dbClient: postgres.Sql | null = null;

export function getDb() {
  if (!dbClient) {
    const url = requireEnv("DATABASE_URL");
    dbClient = postgres(url, opcionesDeConexion(url));
  }

  return dbClient;
}
