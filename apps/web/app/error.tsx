"use client"; // Las pantallas de error de Next son componentes de cliente

import Link from "next/link";

import { captureException } from "@sentry/browser";
import { useEffect } from "react";

import { useLanguage } from "@/lib/language-context";
import { codigoDeError, TEXTO_ERROR } from "@/lib/pagina-error";

/** Error en una página (por ejemplo, el backend no respondió al armarla): mensaje en el idioma elegido y reintento. */
export default function PantallaDeError({ error, retry }: { error: unknown; retry: () => void }) {
  const codigo = codigoDeError(error);
  const texto = TEXTO_ERROR[useLanguage().language];
  // Los errores que atrapa esta pantalla no llegan a window.onerror: se reportan aquí (sin DSN no hace nada).
  // Con digest el error salió del servidor y ya lo reportó onRequestError (instrumentation.ts): no se repite.
  useEffect(() => {
    if (!codigoDeError(error)) captureException(error);
  }, [error]);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 py-10 text-center">
      <p className="text-sm font-bold tracking-[0.3em] text-slate-900">STYLEHUB</p>
      <h1 className="text-2xl font-semibold text-slate-900">{texto.titulo}</h1>
      <p role="alert" className="max-w-md text-sm text-slate-600">
        {texto.detalle}
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          {texto.reintentar}
        </button>
        <Link href="/" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white">
          {texto.inicio}
        </Link>
      </div>
      {codigo ? <p className="text-xs text-slate-400">{texto.codigo}: {codigo}</p> : null}
    </main>
  );
}
