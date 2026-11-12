/** Configuración del API, leída una sola vez de las variables de entorno. */
export type Config = {
  databaseUrl: string;
  port: number;
  /** Origen del front (Next.js) al que se le permite llamar al API desde el navegador. */
  webOrigin: string;
};

export function leerConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error("Falta la variable de entorno DATABASE_URL.");
  const port = Number(env.PORT ?? 4000);
  if (!Number.isInteger(port) || port <= 0) throw new Error(`PORT inválido: ${env.PORT}`);
  return { databaseUrl, port, webOrigin: env.WEB_ORIGIN ?? "http://localhost:3000" };
}
