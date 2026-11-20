// Corre en el navegador antes de que la app sea interactiva (Next: instrumentation-client.ts).
import * as Sentry from "@sentry/browser";

import { opcionesSentryNavegador } from "@/lib/sentry-navegador";

try {
  // Las NEXT_PUBLIC_* se inyectan al compilar solo si se escriben completas
  Sentry.init(
    opcionesSentryNavegador({
      NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
      NODE_ENV: process.env.NODE_ENV,
    }),
  );
} catch {
  // El monitoreo nunca debe romper la app
}
