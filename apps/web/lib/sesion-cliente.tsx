"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";

import type { Sesion } from "@/lib/sesion";

type Estado = "loading" | "authenticated" | "unauthenticated";
type Valor = { data: Sesion | null; status: Estado };

const Contexto = createContext<Valor>({ data: null, status: "loading" });

/**
 * Sesión de la app en el navegador, con la misma forma que useSession de NextAuth ({ data, status }).
 * Se vuelve a pedir a /api/sesion cada vez que cambia el usuario de Clerk (entrar, salir, cambiar de cuenta).
 */
export function SesionProvider({ children }: { children: ReactNode }) {
  const { isLoaded, userId } = useAuth();
  // Resultado de /api/sesion para un usuario de Clerk concreto (si cambia el usuario, se vuelve a pedir).
  const [pedida, setPedida] = useState<{ userId: string; data: Sesion | null } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let vigente = true;
    fetch("/api/sesion", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Sesion | { user: null }>) : { user: null }))
      .then((s) => vigente && setPedida({ userId, data: s.user ? (s as Sesion) : null }))
      .catch(() => vigente && setPedida({ userId, data: null }));
    return () => {
      vigente = false;
    };
  }, [userId]);

  let valor: Valor;
  if (!isLoaded) valor = { data: null, status: "loading" };
  else if (!userId) valor = { data: null, status: "unauthenticated" };
  else if (pedida?.userId !== userId) valor = { data: null, status: "loading" };
  else valor = pedida.data ? { data: pedida.data, status: "authenticated" } : { data: null, status: "unauthenticated" };

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion() {
  return useContext(Contexto);
}

/** Cierra la sesión de Clerk y lleva a la página indicada. */
export function useCerrarSesion() {
  const { signOut } = useClerk();
  return useCallback((destino = "/iniciar-sesion") => signOut({ redirectUrl: destino }), [signOut]);
}
