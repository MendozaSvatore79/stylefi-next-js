"use client";

import { useClerk } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect } from "react";

/**
 * A una cuenta baneada se le cierra la sesión de Clerk y se le explica por qué. (Mandarla a /iniciar-sesion con la
 * sesión de Clerk abierta haría que el formulario la regresara a /entrar una y otra vez.)
 */
export default function CuentaSuspendidaPage() {
  const { signOut } = useClerk();
  useEffect(() => {
    void signOut();
  }, [signOut]);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center">
      <p className="text-sm font-bold tracking-[0.3em] text-slate-900">STYLEHUB</p>
      <h1 className="text-xl font-bold text-slate-900">Tu cuenta está suspendida</h1>
      <p className="max-w-md text-sm text-slate-600">
        Por ahora no puedes entrar. Si crees que es un error, escríbenos a soporte.
      </p>
      <Link href="/iniciar-sesion" className="text-sm font-semibold text-indigo-700 hover:underline">
        Volver a iniciar sesión
      </Link>
    </main>
  );
}
