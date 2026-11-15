/**
 * Llamadas del navegador al backend (synova-backend, NestJS).
 *
 * Desde la fase 4 todas las rutas de datos viven en el backend: api("/api/…") llama a NEXT_PUBLIC_API_URL + "/…"
 * con el token de sesión de Clerk en Authorization. Las rutas se siguen escribiendo con /api para que las pantallas
 * no cambien. Sin NEXT_PUBLIC_API_URL no hay a quién llamar (next.config.ts lo exige al compilar).
 */
const BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || null;

/** URL del backend o null si no está configurado. */
export function urlDelBackend() {
  return BASE;
}

/** ¿Esta ruta va al backend? Todas las de /api/… (ya no quedan rutas de datos en Next). */
export function vaAlBackend(ruta: string) {
  return ruta.startsWith("/api/");
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

/** Como fetch() para las rutas de datos de la app (escritas con /api), pero contra el backend y con el token. */
export async function api(ruta: string, init: RequestInit = {}): Promise<Response> {
  if (!vaAlBackend(ruta)) {
    return fetch(ruta, init);
  }
  if (!BASE) throw new Error("Falta NEXT_PUBLIC_API_URL: el front necesita el backend.");
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
