import type { BrowserOptions, ErrorEvent } from "@sentry/browser";

/**
 * Errores del navegador a Sentry. Sin NEXT_PUBLIC_SENTRY_DSN queda apagado (local, pruebas y CI).
 * Solo errores: sin trazas de rendimiento ni grabación de sesiones. Nada de datos personales: sin usuario, sin
 * cookies ni cabeceras, y las URL sin query ni fragmento (pueden traer tokens, como el `__clerk_ticket`).
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

export function sinQuery(url: string) {
  return url.replace(/[?#].*$/, "");
}

export function limpiarEventoNavegador(evento: ErrorEvent): ErrorEvent {
  delete evento.user;
  if (evento.request) {
    delete evento.request.cookies;
    delete evento.request.headers;
    delete evento.request.query_string;
    if (evento.request.url) evento.request.url = sinQuery(evento.request.url);
  }
  for (const miga of evento.breadcrumbs ?? []) {
    const datos = miga.data as Record<string, unknown> | undefined;
    for (const campo of ["url", "from", "to"]) {
      if (typeof datos?.[campo] === "string") datos[campo] = sinQuery(datos[campo]);
    }
  }
  return evento;
}

export function opcionesSentryNavegador(env: EnvSentry): BrowserOptions {
  const dsn = dsnDeSentry(env);
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: env.NODE_ENV ?? "development",
    // Sentry 11 (`dataCollection` reemplaza a sendDefaultPii): nada de usuario, cookies, cabeceras, cuerpos ni query
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    tracesSampleRate: 0,
    beforeSend: (evento) => limpiarEventoNavegador(evento),
  };
}
