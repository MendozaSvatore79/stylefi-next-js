/**
 * Valida NEXT_PUBLIC_API_URL al compilar (next.config.ts). Sin http:// o https://, el navegador la toma como una ruta
 * relativa del propio sitio (pedía stylehub…/api.stylehub…/entrar, recibía un 404 en HTML y /entrar rebotaba a
 * /iniciar-sesion en bucle). Devuelve un mensaje de error, o null si la URL sirve.
 */
export function errorEnUrlDelBackend(valor: string | undefined): string | null {
  const url = valor?.trim();
  if (!url) return "Falta NEXT_PUBLIC_API_URL (la URL del backend, por ejemplo https://api.tudominio.com).";
  const ejemplo = `NEXT_PUBLIC_API_URL debe empezar con http:// o https:// (por ejemplo https://${url.replace(/^[a-z]+:\/*/i, "")}); vale "${url}".`;
  if (!/^https?:\/\//i.test(url)) return ejemplo;
  try {
    if (!new URL(url).hostname) return ejemplo;
  } catch {
    return ejemplo;
  }
  return null;
}
