/**
 * Llamadas del navegador al backend (synova-backend, NestJS).
 *
 * - Si NEXT_PUBLIC_API_URL está definida, las rutas que ya se movieron al backend (RUTAS_EN_API) van allá, con el
 *   token de sesión de Clerk en Authorization. Las demás siguen yendo a las rutas de Next.js (app/api).
 * - Si no está definida (como en producción mientras el backend no esté desplegado), todo sigue igual que antes.
 *
 * Las rutas del backend se llaman igual que las de app/api, sin el prefijo /api, y responden lo mismo.
 */
const BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || null;

/** Rutas ya movidas al backend (se van agregando por grupo; las de app/api se borran en la fase 4). */
const RUTAS_EN_API = [
  // Grupo 1: negocios y catálogo
  "/api/businesses",
  "/api/business/profile",
  "/api/business/summary",
  "/api/business/services",
  "/api/business/stylists",
  "/api/business/branches",
  "/api/files/",
];

function vaAlBackend(ruta: string) {
  const sinQuery = ruta.split("?")[0];
  return RUTAS_EN_API.some((r) => (r.endsWith("/") ? sinQuery.startsWith(r) : sinQuery === r || sinQuery.startsWith(`${r}/`)));
}

type ClerkGlobal = { session?: { getToken: () => Promise<string | null> } | null };

async function tokenDeClerk(): Promise<string | null> {
  const clerk = (globalThis as { Clerk?: ClerkGlobal }).Clerk;
  return (await clerk?.session?.getToken()) ?? null;
}

/** fetch() para rutas de la app: mismo uso que fetch("/api/..."). */
export async function api(ruta: string, init: RequestInit = {}): Promise<Response> {
  if (!BASE || !vaAlBackend(ruta)) {
    return fetch(ruta, init);
  }
  const headers = new Headers(init.headers);
  const token = await tokenDeClerk();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${BASE}${ruta.replace(/^\/api/, "")}`, { ...init, headers });
}

/**
 * URL de un archivo subido para usarla en <img src> o en un enlace. En la base se guardan como "/api/files/<id>";
 * con el backend activo se sirven en NEXT_PUBLIC_API_URL + "/files/<id>". Cualquier otra URL (https://…) no cambia.
 */
export function urlArchivo<T extends string | null | undefined>(url: T): T {
  if (!BASE || typeof url !== "string" || !url.startsWith("/api/files/")) return url;
  return `${BASE}${url.replace(/^\/api/, "")}` as T;
}

/**
 * Abre un archivo privado (comprobante): se descarga con el token de sesión y se abre desde la memoria del
 * navegador, porque un enlace normal no puede mandar el token al backend.
 */
export async function abrirArchivoPrivado(url: string) {
  const ventana = window.open("", "_blank");
  try {
    const res = await api(url);
    if (!res.ok) throw new Error(`No se pudo abrir el archivo (${res.status}).`);
    const blob = await res.blob();
    const local = URL.createObjectURL(blob);
    if (ventana) ventana.location.href = local;
    else window.location.href = local;
    setTimeout(() => URL.revokeObjectURL(local), 60_000);
  } catch (error) {
    ventana?.close();
    throw error;
  }
}
