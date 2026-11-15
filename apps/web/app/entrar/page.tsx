"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";

import { api } from "@/lib/api";

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

  useEffect(() => {
    if (!isLoaded || isSignedIn) return;
    const espera = window.setTimeout(() => window.location.replace("/iniciar-sesion"), ESPERA_SESION_MS);
    return () => window.clearTimeout(espera);
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let vigente = true;
    api("/api/entrar", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ destino?: string }>)
      .then(({ destino }) => vigente && window.location.replace(destino?.startsWith("/") ? destino : "/iniciar-sesion"))
      .catch(() => vigente && window.location.replace("/iniciar-sesion"));
    return () => {
      vigente = false;
    };
  }, [isLoaded, isSignedIn]);

  return <p className="p-10 text-center text-sm text-slate-500">Entrando…</p>;
}
