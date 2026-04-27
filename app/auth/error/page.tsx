"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

type ErrorInfo = {
  title: string;
  description: string;
};

const errorCopy: Record<string, ErrorInfo> = {
  AccessDenied: {
    title: "Acceso denegado",
    description: "No tienes permisos para iniciar sesión con esta cuenta. Si crees que es un error, contacta al administrador.",
  },
  OAuthSignin: {
    title: "No se pudo iniciar sesión",
    description: "Ocurrió un problema al iniciar sesión con el proveedor. Inténtalo nuevamente en unos segundos.",
  },
  OAuthCallback: {
    title: "Error al validar la sesión",
    description: "No pudimos validar tu autenticación. Vuelve a intentarlo desde la pantalla de inicio de sesión.",
  },
  default: {
    title: "No fue posible iniciar sesión",
    description: "Hubo un problema con la autenticación. Intenta de nuevo o usa otro método de acceso.",
  },
};

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error") || "default";

  const info = useMemo(() => errorCopy[errorCode] ?? errorCopy.default, [errorCode]);

  return (
    <main className="min-h-screen bg-[#ececef] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-6 py-12">
        <section className="w-full overflow-hidden rounded-4xl border border-slate-200 bg-white shadow-[0_26px_80px_rgba(15,23,42,0.15)]">
          <div className="relative bg-linear-to-r from-[#17153d] via-[#1f2760] to-[#2a3b89] px-8 py-10 text-white sm:px-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Stylehub · Seguridad</p>
            <h1 className="mt-3 text-3xl font-black sm:text-4xl">{info.title}</h1>
            <p className="mt-3 max-w-2xl text-sm text-white/80 sm:text-base">{info.description}</p>
            <span className="pointer-events-none absolute -right-14 -top-14 h-42 w-42 rounded-full bg-red-500/25 blur-3xl" />
          </div>

          <div className="px-8 py-8 sm:px-10 sm:py-9">
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <p className="font-semibold">Código de error: {errorCode}</p>
              <p className="mt-1">Si el problema continúa, comparte este código con soporte.</p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/iniciar-sesion"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-[#17153d] px-5 text-sm font-semibold text-white transition hover:bg-[#261f6b]"
              >
                Volver a iniciar sesión
              </Link>
              <Link
                href="/"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Ir al inicio
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
