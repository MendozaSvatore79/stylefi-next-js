/**
 * Los layouts del panel mandan a /iniciar-sesion?reason=unauthorized solo cuando el backend responde que no hay
 * sesión válida (los errores del backend no redirigen). Si Clerk todavía tiene sesión en el navegador, <SignIn> la
 * ve y regresa a /entrar, que vuelve aquí: un bucle. En ese caso hay que cerrar la sesión de Clerk primero.
 */
export function debeReiniciarSesion({
  aviso,
  isLoaded,
  isSignedIn,
}: {
  aviso?: string;
  isLoaded: boolean;
  isSignedIn: boolean | undefined;
}) {
  return aviso === "unauthorized" && isLoaded && isSignedIn === true;
}

/** A dónde regresa después de cerrar la sesión de Clerk: el mismo aviso, ya sin sesión. */
export const DESTINO_TRAS_REINICIO = "/iniciar-sesion?reason=unauthorized";
