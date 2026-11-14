import { auth, currentUser } from "@clerk/nextjs/server";

import { apiServidor } from "@/lib/api-servidor";
import { getDb } from "@/lib/db";

/**
 * Sesión de la app, con la misma forma que tenía la de NextAuth (`{ user: { id, accountType, … } }`), para que las
 * rutas no cambien. La identidad la da Clerk; los permisos (tipo de cuenta, baneo) salen de nuestra base.
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

type FilaUsuario = {
  id: string;
  account_type: Sesion["user"]["accountType"];
  email: string;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
  is_banned: boolean;
};

/** Datos de Clerk de quien inició sesión: correo principal solo si Clerk lo verificó. */
export async function datosDeClerk() {
  const usuario = await currentUser();
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
 * La fila de stylehub_users de quien inició sesión en Clerk. Si aún no está vinculada, la vincula por correo
 * VERIFICADO con una cuenta existente que no tenga otra cuenta de Clerk (decisión: conservar las cuentas que ya
 * existían). Nunca sobrescribe una cuenta ya vinculada ni cambia su tipo.
 */
async function filaDeClerk(clerkUserId: string): Promise<{ fila: FilaUsuario | null; clerk: Awaited<ReturnType<typeof datosDeClerk>> | null }> {
  const db = getDb();
  const [vinculada] = (await db`
    SELECT id, account_type, email, first_name, last_name, business_name, is_banned
    FROM stylehub_users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
  `) as unknown as FilaUsuario[];
  if (vinculada) return { fila: vinculada, clerk: null };

  const clerk = await datosDeClerk();
  if (!clerk?.correoVerificado) return { fila: null, clerk };
  const [ligada] = (await db`
    UPDATE stylehub_users SET clerk_user_id = ${clerkUserId}, updated_at = NOW()
    WHERE email = ${clerk.correoVerificado} AND clerk_user_id IS NULL
    RETURNING id, account_type, email, first_name, last_name, business_name, is_banned
  `) as unknown as FilaUsuario[];
  return { fila: ligada ?? null, clerk };
}

/**
 * Sesión de la app o null (sin sesión de Clerk, sin cuenta en nuestra base, o cuenta baneada).
 * Reemplaza a getServerSession(authConfig) de NextAuth.
 */
export async function obtenerSesion(): Promise<Sesion | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const { fila, clerk } = await filaDeClerk(userId);
  if (!fila || fila.is_banned) return null;
  const datos = clerk ?? (await datosDeClerk());
  const nombre =
    [fila.first_name, fila.last_name].filter(Boolean).join(" ").trim() || fila.business_name || null;
  return {
    user: {
      id: fila.id,
      accountType: fila.account_type,
      email: fila.email,
      name: nombre,
      image: datos?.imagen ?? null,
      authProvider: datos?.conGoogle ? "google" : "credentials",
    },
  };
}

/**
 * Con el backend configurado (NEXT_PUBLIC_API_URL), a dónde va quien hace la petición según el backend (GET /entrar,
 * que también vincula cuentas existentes): así estas páginas no consultan la base desde Vercel. null sin backend.
 */
async function destinoDelBackend(): Promise<string | null> {
  const r = await apiServidor("/entrar");
  if (!r) return null;
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
  if (destino !== null) {
    if (destino === "/iniciar-sesion") return { estado: "sin-sesion" };
    if (destino === "/cuenta-suspendida") return { estado: "baneada" };
    const tipo = TIPO_POR_PANEL[destino];
    if (tipo) return { estado: "lista", accountType: tipo };
    const datos = await datosDeClerk();
    return datos ? { estado: "sin-registro", clerk: datos } : { estado: "sin-sesion" };
  }
  const { userId } = await auth();
  if (!userId) return { estado: "sin-sesion" };
  const { fila, clerk } = await filaDeClerk(userId);
  if (fila?.is_banned) return { estado: "baneada" };
  if (fila) return { estado: "lista", accountType: fila.account_type };
  const datos = clerk ?? (await datosDeClerk());
  if (!datos) return { estado: "sin-sesion" };
  return { estado: "sin-registro", clerk: datos };
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
  // Con backend: una sola pregunta a /entrar (la sesión completa la arma el navegador con /sesion)
  const destino = await destinoDelBackend();
  if (destino !== null) {
    if (destino === inicioPorTipo(tipo)) return { sesion: null };
    return { redirigir: destino === "/iniciar-sesion" ? "/iniciar-sesion?reason=unauthorized" : destino };
  }
  const sesion = await obtenerSesion();
  if (sesion?.user.accountType === tipo) return { sesion };
  if (sesion) return { redirigir: inicioPorTipo(sesion.user.accountType) };
  const estado = await estadoDeRegistro();
  if (estado.estado === "sin-registro") return { redirigir: "/registro/completar" };
  if (estado.estado === "baneada") return { redirigir: "/cuenta-suspendida" };
  return { redirigir: "/iniciar-sesion?reason=unauthorized" };
}
