// Sentry del runtime edge del front. Lo carga register() de instrumentation.ts.
import * as Sentry from "@sentry/nextjs";

import { opcionesSentryServidor } from "@/lib/sentry-servidor";

try {
  Sentry.init(opcionesSentryServidor({ SENTRY_DSN: process.env.SENTRY_DSN, NODE_ENV: process.env.NODE_ENV }));
} catch {
  // El monitoreo nunca debe romper la app
}
