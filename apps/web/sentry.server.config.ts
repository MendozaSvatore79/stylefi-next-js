// Sentry del runtime Node.js del front. Lo carga register() de instrumentation.ts.
import * as Sentry from "@sentry/nextjs";

import { getOptionalEnv } from "@/lib/env";
import { opcionesSentryServidor } from "@/lib/sentry-servidor";

try {
  Sentry.init(opcionesSentryServidor({ SENTRY_DSN: getOptionalEnv("SENTRY_DSN"), NODE_ENV: getOptionalEnv("NODE_ENV") }));
} catch (error) {
  // El monitoreo nunca debe romper la app, pero el fallo debe verse en los logs. Solo el tipo de error: el mensaje
  // puede incluir el DSN.
  console.warn("Sentry (servidor) no se pudo iniciar:", error instanceof Error ? error.name : "error desconocido");
}
