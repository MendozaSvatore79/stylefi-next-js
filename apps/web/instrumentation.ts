// Instrumentación del servidor (Next: instrumentation.ts). Cada runtime carga solo su configuración de Sentry.
import { captureRequestError } from "@sentry/nextjs";
import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config");
}

/** Errores de páginas, rutas, acciones y proxy en el servidor. Sin DSN, Sentry no tiene cliente y no hace nada. */
export const onRequestError: Instrumentation.onRequestError = (error, peticion, contexto) =>
  captureRequestError(error, peticion, contexto);
