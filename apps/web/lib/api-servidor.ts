import { auth } from "@clerk/nextjs/server";

import { urlDelBackend } from "@/lib/api";

/**
 * Llamada al backend desde el servidor de Next.js (páginas y layouts que se arman en el servidor), con el token de
 * sesión de Clerk de quien hace la petición. Devuelve null si NEXT_PUBLIC_API_URL no está definida: entonces quien
 * llama sigue usando la base como antes (producción mientras el backend no esté desplegado).
 * La ruta va sin /api: "/entrar", "/live-dashboard".
 */
export async function apiServidor(ruta: string, init: RequestInit = {}): Promise<Response | null> {
  const base = urlDelBackend();
  if (!base) return null;
  const headers = new Headers(init.headers);
  const { getToken } = await auth();
  const token = await getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${base}${ruta}`, { ...init, headers, cache: "no-store" });
}
