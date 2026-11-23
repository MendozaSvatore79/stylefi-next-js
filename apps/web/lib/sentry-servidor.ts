import type { ErrorEvent } from "@sentry/nextjs";

import { limpiarEvento, SIN_DATOS_PERSONALES } from "@/lib/sentry-limpieza";

/**
 * Errores del servidor y del edge del front a Sentry (sentry.server.config.ts y sentry.edge.config.ts).
 * Sin SENTRY_DSN queda apagado. Es una variable de servidor: no se incrusta en el JS del navegador.
 */
export type EnvSentryServidor = { SENTRY_DSN?: string; NODE_ENV?: string };

/** Opciones comunes a Node y edge (los dos `init` aceptan este subconjunto). */
export type OpcionesSentryServidor = {
  dsn: string | undefined;
  enabled: boolean;
  environment: string;
  dataCollection: { userInfo: false; cookies: false; httpHeaders: false; httpBodies: never[]; urlQueryParams: false };
  tracesSampleRate: 0;
  beforeSend: (evento: ErrorEvent) => ErrorEvent;
};

export function opcionesSentryServidor(env: EnvSentryServidor): OpcionesSentryServidor {
  const dsn = env.SENTRY_DSN?.trim() || undefined;
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: env.NODE_ENV ?? "development",
    dataCollection: { ...SIN_DATOS_PERSONALES, httpBodies: [] },
    tracesSampleRate: 0,
    beforeSend: (evento) => limpiarEvento(evento),
  };
}
