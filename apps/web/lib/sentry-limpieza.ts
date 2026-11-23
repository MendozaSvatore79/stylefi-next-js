import type { ErrorEvent } from "@sentry/browser";

/**
 * Limpieza común de los eventos de Sentry (navegador, servidor y edge). Nada de datos personales: sin usuario,
 * cookies, cabeceras (Authorization y la sesión de Clerk viajan ahí), cuerpos ni variables de entorno, y las URL
 * sin query ni fragmento (pueden traer tokens, como el `__clerk_ticket`). Los textos se tachan con las mismas reglas
 * que el backend (synova-backend/src/comun/sentry-config.ts), para que los dos lados manden lo mismo.
 */

/** Lo que el SDK no debe recolectar por su cuenta (Sentry 11: `dataCollection` reemplaza a sendDefaultPii). */
export const SIN_DATOS_PERSONALES = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
} as const;

const CORREO = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const TELEFONO = /(?<![\w])\+?(?:\d[\s().-]*){6,14}\d(?![\w])/g;
/** RFC de persona moral (3 letras) o física (4 letras), fecha AAMMDD válida y homoclave de 3 caracteres. */
const RFC = /(?<![A-Z0-9Ñ&])[A-ZÑ&]{3,4}\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])[A-Z0-9]{3}(?![A-Z0-9Ñ&])/gi;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
/** Tokens de sesión (Clerk) y cualquier otro JWT: tres segmentos base64url, el primero empieza con `eyJ`. */
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
/** Llaves secretas y restringidas de Stripe y Clerk (`sk_`/`rk_` live o test) y secretos de webhook (`whsec_`). */
const LLAVE_SECRETA = /\b(?:(?:sk|rk)_(?:live|test)_|whsec_)[A-Za-z0-9]+/g;
/** Nombres de campo cuyo valor se tacha completo, sin importar su forma (`extra`, `contexts`, migas…). */
const CLAVE_SENSIBLE =
  /password|passwd|contrase[nñ]a|secret|token|authorization|cookie|api[-_]?key|signature|firma|cvv|clabe|phone|tel[eé]fono|celular/i;
const FILTRADO = "[filtrado]";
/** Query y fragmento de una URL dentro de un texto: absoluta (`https://…?x`) o ruta (`/sign-in?__clerk_ticket=…`). */
const URL_ABSOLUTA_CON_QUERY = /(\bhttps?:\/\/[^\s?#"'<>]+)[?#][^\s"'<>]*/gi;
const RUTA_CON_QUERY = /(^|[\s"'(=])(\/[^\s?#"'<>]*)[?#][^\s"'<>)]*/g;

export function sinQuery(url: string) {
  return url.replace(/[?#].*$/, "");
}

/** Tacha secretos y datos personales de un texto. */
export function tacharTexto(texto: string): string {
  // Primero las query de las URL (pueden traer tokens como `__clerk_ticket`); luego los secretos, que llevan dígitos
  // que la regla de teléfono tacharía a medias
  return texto
    .replace(URL_ABSOLUTA_CON_QUERY, "$1")
    .replace(RUTA_CON_QUERY, "$1$2")
    .replace(BEARER, `Bearer ${FILTRADO}`)
    .replace(JWT, "[token]")
    .replace(LLAVE_SECRETA, "[llave]")
    .replace(CORREO, "[correo]")
    .replace(RFC, "[rfc]")
    .replace(TELEFONO, "[teléfono]");
}

function tacharValor(valor: unknown): unknown {
  if (typeof valor === "string") return tacharTexto(valor);
  if (Array.isArray(valor)) return valor.map(tacharValor);
  if (valor && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor).map(([clave, contenido]) => [
        tacharTexto(clave),
        CLAVE_SENSIBLE.test(clave) ? FILTRADO : tacharValor(contenido),
      ]),
    );
  }
  return valor;
}

/** beforeSend: segunda línea por si el SDK o una integración agregan algo de todos modos. */
export function limpiarEvento(evento: ErrorEvent): ErrorEvent {
  delete evento.user;
  if (evento.request) {
    delete evento.request.cookies;
    delete evento.request.headers;
    delete evento.request.query_string;
    delete evento.request.data;
    delete evento.request.env;
    if (evento.request.url) evento.request.url = sinQuery(evento.request.url);
  }
  // En el servidor el nombre de la transacción puede ser la ruta pedida, con su query
  if (evento.transaction) evento.transaction = sinQuery(evento.transaction);
  for (const miga of evento.breadcrumbs ?? []) {
    const datos = miga.data as Record<string, unknown> | undefined;
    for (const campo of ["url", "from", "to"]) {
      if (typeof datos?.[campo] === "string") datos[campo] = sinQuery(datos[campo]);
    }
  }
  // El mensaje del error y las migas de consola pueden traer correos o teléfonos de la persona
  return tacharValor(evento) as ErrorEvent;
}
