"use client";

import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import type { Sesion } from "@/lib/sesion";
import { ContextoSesion, type ValorSesion } from "@/lib/sesion-contexto";

export { useSesion } from "@/lib/sesion-contexto";

/** Lo que /sesion devuelve: el backend ya no manda la foto ni si entró con Google (salen de Clerk, aquí). */
type SesionSinClerk = { user: Omit<Sesion["user"], "image" | "authProvider"> & Partial<Pick<Sesion["user"], "image" | "authProvider">> };


/**
 * Sesión de la app en el navegador, con la misma forma que useSession de NextAuth ({ data, status }).
 * Se vuelve a pedir a /api/sesion cada vez que cambia el usuario de Clerk (entrar, salir, cambiar de cuenta).
 * La foto y si entró con Google se toman del usuario de Clerk que ya cargó el navegador.
 */
export function SesionProvider({ children }: { children: ReactNode }) {
  const { isLoaded, userId } = useAuth();
  const { user: usuarioClerk } = useUser();
  // Resultado de /api/sesion para un usuario de Clerk concreto (si cambia el usuario, se vuelve a pedir).
  const [pedida, setPedida] = useState<{ userId: string; data: SesionSinClerk | null } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let vigente = true;
    api("/api/sesion", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<SesionSinClerk | { user: null }>) : { user: null }))
      .then((s) => vigente && setPedida({ userId, data: s.user ? (s as SesionSinClerk) : null }))
      .catch(() => vigente && setPedida({ userId, data: null }));
    return () => {
      vigente = false;
    };
  }, [userId]);

  const imagenClerk = usuarioClerk?.imageUrl ?? null;
  const conGoogle = usuarioClerk?.externalAccounts.some((c) => c.provider.includes("google")) ?? false;
  // Mismo objeto mientras no cambie nada, para no volver a disparar efectos que dependen de la sesión
  const valor = useMemo<ValorSesion>(() => {
    if (!isLoaded) return { data: null, status: "loading" };
    if (!userId) return { data: null, status: "unauthenticated" };
    if (pedida?.userId !== userId) return { data: null, status: "loading" };
    if (!pedida.data) return { data: null, status: "unauthenticated" };
    return {
      data: {
        user: {
          ...pedida.data.user,
          // Sin backend, /api/sesion de Next todavía los manda; con backend salen de Clerk
          image: pedida.data.user.image ?? imagenClerk,
          authProvider: pedida.data.user.authProvider ?? (conGoogle ? "google" : "credentials"),
        },
      },
      status: "authenticated",
    };
  }, [isLoaded, userId, pedida, imagenClerk, conGoogle]);

  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>;
}

/** Cierra la sesión de Clerk y lleva a la página indicada. */
export function useCerrarSesion() {
  const { signOut } = useClerk();
  return useCallback((destino = "/iniciar-sesion") => signOut({ redirectUrl: destino }), [signOut]);
}
