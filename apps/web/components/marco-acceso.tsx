import type { ReactNode } from "react";

const AVISOS: Record<string, string> = {
  unauthorized: "Inicia sesión con una cuenta que tenga acceso a esa sección.",
};

/** Marco común de las pantallas de entrar y registrarse (los formularios son de Clerk). */
export default function MarcoAcceso({ aviso, children }: { aviso?: string; children: ReactNode }) {
  const texto = aviso ? AVISOS[aviso] : undefined;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 py-10">
      <p className="text-sm font-bold tracking-[0.3em] text-slate-900">STYLEHUB</p>
      {texto ? (
        <p role="alert" className="w-full max-w-md rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-sm text-amber-800">
          {texto}
        </p>
      ) : null}
      {children}
    </main>
  );
}
