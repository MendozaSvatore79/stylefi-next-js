"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { interpretarRespuestaEntrar } from "@/lib/respuesta-entrar";

/** Si Clerk terminó de cargar y la sesión no aparece en este tiempo, se va a iniciar sesión. */
export const ESPERA_SESION_MS = 5000;

/**
 * Clerk llega aquí después de entrar o registrarse. Se pregunta a dónde ir (/api/entrar) y se navega con una carga
 * completa: así el panel se arma con la sesión nueva (la navegación interna de Clerk no seguía la redirección).
 *
 * Se pregunta solo cuando Clerk ya tiene la sesión en el navegador: justo después de entrar, Clerk puede estar
 * cargado pero sin sesión un instante; preguntar entonces (sin token) hacía que el backend contestara
 * "/iniciar-sesion" y la persona rebotaba por el login.
 */
export default function EntrarPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [fallo, setFallo] = useState<"limite" | "temporal" | null>(null);
  const [espera, setEspera] = useState(0);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!isLoaded || isSignedIn) return;
    const espera = window.setTimeout(() => window.location.replace("/iniciar-sesion"), ESPERA_SESION_MS);
    return () => window.clearTimeout(espera);
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let vigente = true;
    void api("/api/entrar", { cache: "no-store" })
      .then(interpretarRespuestaEntrar)
      .then((resultado) => {
        if (!vigente) return;
        if (resultado.tipo === "destino") {
          window.location.replace(resultado.destino);
          return;
        }
        setFallo(resultado.tipo === "espera" ? "limite" : "temporal");
        setEspera(resultado.tipo === "espera" ? resultado.segundos : 0);
      })
      .catch(() => {
        if (vigente) {
          setFallo("temporal");
          setEspera(0);
        }
      });
    return () => {
      vigente = false;
    };
  }, [isLoaded, isSignedIn, intento]);

  useEffect(() => {
    if (espera <= 0) return;
    const timer = window.setTimeout(() => setEspera((actual) => Math.max(0, actual - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [espera]);

  return (
    <main className="p-10 text-center text-sm text-slate-500">
      {fallo ? (
        <section className="mx-auto max-w-md space-y-3">
          <p role="alert">
            {fallo === "limite"
              ? "Estamos recibiendo demasiadas solicitudes. Espera un momento antes de continuar."
              : "No pudimos validar tu sesión. Inténtalo de nuevo."}
          </p>
          {fallo === "limite" && espera > 0 && <p>Podrás reintentar en {espera} s.</p>}
          <button
            type="button"
            className="rounded-md bg-indigo-600 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={espera > 0}
            onClick={() => {
              setFallo(null);
              setIntento((actual) => actual + 1);
            }}
          >
            Reintentar
          </button>
        </section>
      ) : (
        <p>Entrando…</p>
      )}
    </main>
  );
}
