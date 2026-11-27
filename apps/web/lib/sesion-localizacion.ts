import { esMX } from "@clerk/localizations";

/** Mensaje de Clerk para una cuenta suspendida (código user_banned). La traducción esMX no lo trae. */
export const MENSAJE_CUENTA_SUSPENDIDA =
  "Tu cuenta está suspendida. Si crees que es un error, escríbenos por el soporte de STYLEHUB.";

/**
 * Traducción de Clerk: esMX más los errores que le faltan. Sin user_banned, Clerk mostraba el texto del API en
 * inglés ("You have been banned…") a quien intentaba entrar con una cuenta suspendida (pruebas de flujo,
 * 2026-11-24). Clerk busca cada error como unstable__errors.<código> y, si no está, usa el texto del API.
 * Solo se importa desde app/(con-sesion): Clerk no debe llegar a las páginas públicas.
 */
export const localizacionClerk = {
  ...esMX,
  unstable__errors: {
    ...esMX.unstable__errors,
    user_banned: MENSAJE_CUENTA_SUSPENDIDA,
  },
};
