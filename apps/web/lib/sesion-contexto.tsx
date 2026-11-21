"use client";

import { createContext, type ReactNode, useContext } from "react";

import type { Sesion } from "@/lib/sesion";

/**
 * Contexto de la sesión, sin Clerk: lo usan también las páginas públicas (la portada), que no cargan Clerk.
 * El proveedor con Clerk está en lib/sesion-cliente.tsx (solo en el grupo app/(con-sesion)).
 */
export type EstadoSesion = "loading" | "authenticated" | "unauthenticated";
export type ValorSesion = { data: Sesion | null; status: EstadoSesion };

export const ContextoSesion = createContext<ValorSesion>({ data: null, status: "loading" });

const ANONIMA: ValorSesion = { data: null, status: "unauthenticated" };

/** Páginas sin Clerk: la visita cuenta como sin sesión (AURA pide nombre y correo). */
export function SesionAnonima({ children }: { children: ReactNode }) {
  return <ContextoSesion.Provider value={ANONIMA}>{children}</ContextoSesion.Provider>;
}

export function useSesion() {
  return useContext(ContextoSesion);
}
