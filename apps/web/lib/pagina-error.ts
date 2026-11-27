import type { Language } from "@/lib/idioma-guardado";

/** Textos y código de referencia de las pantallas de error (app/error.tsx y app/global-error.tsx), en ES y EN. */
export const TEXTO_ERROR: Record<Language, { titulo: string; detalle: string; reintentar: string; inicio: string; codigo: string }> = {
  es: {
    titulo: "Algo salió mal",
    detalle: "No pudimos cargar esta página. Puede ser un problema momentáneo del servidor; inténtalo de nuevo.",
    reintentar: "Intentar de nuevo",
    inicio: "Ir al inicio",
    codigo: "Código",
  },
  en: {
    titulo: "Something went wrong",
    detalle: "We couldn't load this page. It may be a temporary server problem; please try again.",
    reintentar: "Try again",
    inicio: "Go to home",
    codigo: "Code",
  },
};

/**
 * Código para soporte: Next manda los errores del servidor con un mensaje genérico y un `digest` que identifica el
 * error en los registros. Nunca se muestra el mensaje del error (puede traer detalles internos).
 */
export function codigoDeError(error: unknown): string | null {
  if (error && typeof error === "object" && "digest" in error && typeof error.digest === "string" && error.digest) {
    return error.digest;
  }
  return null;
}
