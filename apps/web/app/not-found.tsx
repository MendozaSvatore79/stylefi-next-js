import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Página no encontrada · Stylehub" };

/** 404 en español (en lugar de la página genérica de Next). */
export default function NoEncontrada() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 py-10 text-center">
      <p className="text-sm font-bold tracking-[0.3em] text-slate-900">STYLEHUB</p>
      <h1 className="text-2xl font-semibold text-slate-900">No encontramos esta página</h1>
      <p className="max-w-md text-sm text-slate-600">Puede que el enlace esté mal escrito o que la página ya no exista.</p>
      <Link href="/" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
        Ir al inicio
      </Link>
    </main>
  );
}
