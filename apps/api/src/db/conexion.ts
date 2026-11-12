import type postgres from "postgres";

/** Hosts locales (PostgreSQL en Docker): el único caso en que no se exige SSL. */
const HOSTS_LOCALES = new Set(["localhost", "127.0.0.1", "::1", "postgres"]);

/**
 * Opciones del cliente postgres para el API (servidor que corre todo el tiempo junto a RDS):
 * un pool de 10 conexiones, cierre de las inactivas y SSL obligatorio fuera de local.
 * "postgres" es el nombre del servicio de la base en compose.yaml (red interna de Docker).
 */
export function opcionesDeConexion(url: string): postgres.Options<Record<string, never>> {
  const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
  return {
    max: 10,
    idle_timeout: 30, // segundos
    connect_timeout: 10, // segundos
    ssl: HOSTS_LOCALES.has(host) ? false : "require",
    onnotice: () => {},
  };
}
