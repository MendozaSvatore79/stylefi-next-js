"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { useEffect, type ReactNode } from "react";

import { debeReiniciarSesion, DESTINO_TRAS_REINICIO } from "@/lib/reinicio-sesion";

const AVISOS: Record<string, string> = {
  unauthorized: "Inicia sesión con una cuenta que tenga acceso a esa sección.",
};

/** Marco común de las pantallas de entrar y registrarse (los formularios son de Clerk). */
export default function MarcoAcceso({ aviso, children }: { aviso?: string; children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const texto = aviso ? AVISOS[aviso] : undefined;

  const cerrandoSesion = debeReiniciarSesion({ aviso, isLoaded, isSignedIn });

  useEffect(() => {
    if (!cerrandoSesion) return;
    void signOut({ redirectUrl: DESTINO_TRAS_REINICIO });
  }, [cerrandoSesion, signOut]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 py-10">
      <p className="text-sm font-bold tracking-[0.3em] text-slate-900">STYLEHUB</p>
      {texto ? (
        <p role="alert" className="w-full max-w-md rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-sm text-amber-800">
          {texto}
        </p>
      ) : null}
      {cerrandoSesion ? <p className="text-sm text-slate-500">Reiniciando sesión…</p> : children}
    </main>
  );
}
