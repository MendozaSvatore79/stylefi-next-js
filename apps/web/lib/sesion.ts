import { currentUser } from "@clerk/nextjs/server";

import { apiServidor } from "@/lib/api-servidor";

/**
 * Sesión de la app, con la misma forma que tenía la de NextAuth (`{ user: { id, accountType, … } }`). La identidad la
 * da Clerk; los permisos (tipo de cuenta, baneo) los decide el backend (fase 4: el front ya no lee la base).
 */
export type Sesion = {
  user: {
    id: string;
    accountType: "cliente" | "negocio" | "admin";
    email: string;
    name: string | null;
    image: string | null;
    authProvider: "google" | "credentials";
  };
};

/** Datos de Clerk de quien inició sesión: correo principal solo si Clerk lo verificó. */
export async function datosDeClerk() {
  let usuario: Awaited<ReturnType<typeof currentUser>>;
  try {
    usuario = await currentUser();
  } catch (error) {
    // La cookie es de un usuario que ya no existe en Clerk (por ejemplo, recién eliminó su cuenta): sin sesión,
    // en vez del 500 que daba la página. Cualquier otro error de Clerk se propaga.
    if ((error as { status?: number } | null)?.status === 404) return null;
    throw error;
  }
  if (!usuario) return null;
  const principal = usuario.emailAddresses.find((e) => e.id === usuario.primaryEmailAddressId);
  const correoVerificado =
    principal?.verification?.status === "verified" ? principal.emailAddress.trim().toLowerCase() : null;
  return {
    clerkUserId: usuario.id,
    correoVerificado,
    nombre: usuario.firstName ?? null,
    apellido: usuario.lastName ?? null,
    imagen: usuario.imageUrl ?? null,
    conGoogle: usuario.externalAccounts.some((c) => c.provider.includes("google")),
  };
}

/**
 * A dónde va quien hace la petición según el backend (GET /entrar, que también vincula cuentas existentes). Desde la
 * fase 4 es el único camino: sin NEXT_PUBLIC_API_URL no hay a quién preguntar.
 */
async function destinoDelBackend(): Promise<string> {
  const r = await apiServidor("/entrar");
  if (!r) throw new Error("Falta NEXT_PUBLIC_API_URL: el front necesita el backend.");
  if (!r.ok) throw new Error(`El backend no respondió a /entrar (${r.status}).`);
  const { destino } = (await r.json()) as { destino?: string };
  if (!destino?.startsWith("/")) throw new Error("El backend respondió /entrar sin destino.");
  return destino;
}

const TIPO_POR_PANEL: Record<string, Sesion["user"]["accountType"]> = {
  "/dashboard/admin": "admin",
  "/dashboard/negocio": "negocio",
  "/dashboard/cliente": "cliente",
};

/**
 * Para la pantalla de registro: "sin-sesion" (no entró a Clerk), "sin-registro" (entró a Clerk pero aún no eligió
 * cliente o negocio), "baneada", o "lista" con su tipo de cuenta.
 */
export async function estadoDeRegistro(): Promise<
  | { estado: "sin-sesion" }
  | { estado: "baneada" }
  | { estado: "lista"; accountType: Sesion["user"]["accountType"] }
  | { estado: "sin-registro"; clerk: NonNullable<Awaited<ReturnType<typeof datosDeClerk>>> }
> {
  const destino = await destinoDelBackend();
  if (destino === "/iniciar-sesion") return { estado: "sin-sesion" };
  if (destino === "/cuenta-suspendida") return { estado: "baneada" };
  const tipo = TIPO_POR_PANEL[destino];
  if (tipo) return { estado: "lista", accountType: tipo };
  const datos = await datosDeClerk();
  return datos ? { estado: "sin-registro", clerk: datos } : { estado: "sin-sesion" };
}

/** A dónde mandar a cada tipo de cuenta después de entrar. */
export function inicioPorTipo(accountType: Sesion["user"]["accountType"]) {
  return accountType === "admin" ? "/dashboard/admin" : accountType === "negocio" ? "/dashboard/negocio" : "/dashboard/cliente";
}

/**
 * Para los layouts del panel: devuelve la sesión si es del tipo pedido; si no, a dónde redirigir
 * (completar registro, su propio panel, o iniciar sesión). Es solo experiencia: cada ruta de datos verifica por su cuenta.
 */
export async function accesoAlPanel(
  tipo: Sesion["user"]["accountType"],
): Promise<{ sesion: Sesion | null } | { redirigir: string }> {
  // Una sola pregunta a /entrar (la sesión completa la arma el navegador con /sesion)
  const destino = await destinoDelBackend();
  if (destino === inicioPorTipo(tipo)) return { sesion: null };
  return { redirigir: destino === "/iniciar-sesion" ? "/iniciar-sesion?reason=unauthorized" : destino };
}
