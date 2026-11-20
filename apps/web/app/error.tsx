"use client"; // Las pantallas de error de Next son componentes de cliente

import Link from "next/link";

import { codigoDeError, TEXTO_ERROR } from "@/lib/pagina-error";

/** Error en una página (por ejemplo, el backend no respondió al armarla): mensaje en español y reintento. */
export default function PantallaDeError({ error, retry }: { error: unknown; retry: () => void }) {
  const codigo = codigoDeError(error);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 py-10 text-center">
      <p className="text-sm font-bold tracking-[0.3em] text-slate-900">STYLEHUB</p>
      <h1 className="text-2xl font-semibold text-slate-900">{TEXTO_ERROR.titulo}</h1>
      <p role="alert" className="max-w-md text-sm text-slate-600">
        {TEXTO_ERROR.detalle}
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          {TEXTO_ERROR.reintentar}
        </button>
        <Link href="/" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white">
          {TEXTO_ERROR.inicio}
        </Link>
      </div>
      {codigo ? <p className="text-xs text-slate-400">Código: {codigo}</p> : null}
    </main>
  );
}
