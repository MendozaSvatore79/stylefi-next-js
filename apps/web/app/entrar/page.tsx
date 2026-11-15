"use client";

import { useEffect } from "react";

import { api } from "@/lib/api";

/**
 * Clerk llega aquí después de entrar o registrarse. Se pregunta a dónde ir (/api/entrar) y se navega con una carga
 * completa: así el panel se arma con la sesión nueva (la navegación interna de Clerk no seguía la redirección).
 */
export default function EntrarPage() {
  useEffect(() => {
    let vigente = true;
    api("/api/entrar", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ destino?: string }>)
      .then(({ destino }) => vigente && window.location.replace(destino?.startsWith("/") ? destino : "/iniciar-sesion"))
      .catch(() => vigente && window.location.replace("/iniciar-sesion"));
    return () => {
      vigente = false;
    };
  }, []);
  return <p className="p-10 text-center text-sm text-slate-500">Entrando…</p>;
}
