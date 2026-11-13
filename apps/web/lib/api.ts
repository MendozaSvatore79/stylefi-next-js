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

/** URL del backend o null si no está configurado (entonces todo sigue en las rutas de Next.js). */
export function urlDelBackend() {
  return BASE;
}

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
  // Grupo 2: reservas y pagos (el webhook de Stripe no se llama desde el navegador)
  "/api/client/appointments",
  "/api/client/favorites",
  "/api/client/wallet",
  "/api/client/payment-methods",
  "/api/business/appointments",
  // Grupo 3: admin, panel en vivo, bienvenida, sesión, registro, cuenta y geocodificación (soporte aún no: B3)
  "/api/admin/users",
  "/api/admin/branch-verifications",
  "/api/admin/live-dashboard",
  "/api/live-dashboard",
  "/api/onboarding",
  "/api/client/onboarding",
  "/api/sesion",
  "/api/entrar",
  "/api/registro/completar",
  "/api/account/security",
  "/api/geocode/reverse",
];

/** ¿Esta ruta de app/api ya vive en el backend (con NEXT_PUBLIC_API_URL definida)? */
export function vaAlBackend(ruta: string) {
  const sinQuery = ruta.split("?")[0];
  return RUTAS_EN_API.some((r) => (r.endsWith("/") ? sinQuery.startsWith(r) : sinQuery === r || sinQuery.startsWith(`${r}/`)));
}

type ClerkGlobal = { loaded?: boolean; session?: { getToken: () => Promise<string | null> } | null };

const ESPERA_CLERK_MS = 10_000;

/**
 * Token de sesión de Clerk. Las pantallas piden sus datos al montarse, a veces antes de que Clerk termine de
 * cargar en el navegador: se espera a que cargue (hasta 10 s) para no mandar la petición sin token.
 */
async function tokenDeClerk(): Promise<string | null> {
  const fin = Date.now() + ESPERA_CLERK_MS;
  let clerk = (globalThis as { Clerk?: ClerkGlobal }).Clerk;
  while (!clerk?.loaded && Date.now() < fin) {
    await new Promise((r) => setTimeout(r, 50));
    clerk = (globalThis as { Clerk?: ClerkGlobal }).Clerk;
  }
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
