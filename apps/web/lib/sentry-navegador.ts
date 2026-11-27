import type { BrowserOptions } from "@sentry/browser";

import { limpiarEvento, SIN_DATOS_PERSONALES } from "./sentry-limpieza";

/**
 * Errores del navegador a Sentry. Sin NEXT_PUBLIC_SENTRY_DSN queda apagado (local, pruebas y CI).
 * Solo errores: sin trazas de rendimiento ni grabación de sesiones. La limpieza de datos personales es la común
 * (lib/sentry-limpieza.ts).
 */
export type EnvSentry = { NEXT_PUBLIC_SENTRY_DSN?: string; NODE_ENV?: string };

export function dsnDeSentry(env: EnvSentry) {
  return env.NEXT_PUBLIC_SENTRY_DSN?.trim() || undefined;
}

/** Origen al que el navegador manda los errores (para connect-src de la CSP), o null sin DSN válido. */
export function origenDeSentry(dsn: string | undefined) {
  if (!dsn) return null;
  try {
    return new URL(dsn).origin;
  } catch {
    return null;
  }
}

export function opcionesSentryNavegador(env: EnvSentry): BrowserOptions {
  const dsn = dsnDeSentry(env);
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: env.NODE_ENV ?? "development",
    dataCollection: { ...SIN_DATOS_PERSONALES, httpBodies: [] },
    tracesSampleRate: 0,
    beforeSend: (evento) => limpiarEvento(evento),
  };
}
