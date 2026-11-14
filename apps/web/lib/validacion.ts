/**
 * Límites y formatos de los formularios (decisiones de producto, 2026-11-14). Mismos valores que el backend
 * (synova-backend/src/comun/validacion.ts), que vuelve a validar todo: si cambia uno, cambian los dos.
 * Las funciones `error*` devuelven el mensaje para la persona, o null si el valor sirve.
 */

export type Idioma = "es" | "en";

export const LIMITES = {
  nombre: 60,
  nombreLegal: 120,
  nombreCorto: 80,
  direccion: 160,
  ciudad: 80,
  estado: 80,
  descripcion: 500,
  url: 300,
  correo: 254,
} as const;

export const PRECIO_MAXIMO = 100_000;
export const DURACION_MINIMA = 5;
export const DURACION_MAXIMA = 480;
export const ANIOS_MAXIMOS = 60;

const CONTROL = /[\u0000-\u001F\u007F]/;
const CONTROL_MULTILINEA = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

/** Mientras se escribe: solo dígitos, sin la lada 52 si pegaron 12 dígitos, y nunca más de 10. */
export function limpiarTelefono(valor: string): string {
  const digitos = valor.replace(/\D/g, "");
  const sinLada = digitos.length === 12 && digitos.startsWith("52") ? digitos.slice(2) : digitos;
  return sinLada.slice(0, 10);
}

/** Mientras se escribe: solo dígitos, máximo 5. */
export function limpiarCodigoPostal(valor: string): string {
  return valor.replace(/\D/g, "").slice(0, 5);
}

export function errorTexto(
  valor: string,
  campo: { es: string; en: string },
  max: number,
  idioma: Idioma,
  o: { obligatorio?: boolean; multilinea?: boolean } = {},
): string | null {
  const en = idioma === "en";
  const limpio = valor.trim();
  if (!limpio) return o.obligatorio ? (en ? `${campo.en} is required.` : `${campo.es} es obligatorio.`) : null;
  if ((o.multilinea ? CONTROL_MULTILINEA : CONTROL).test(limpio)) {
    return en ? `${campo.en} has characters that aren't allowed.` : `${campo.es} tiene caracteres no permitidos.`;
  }
  if (limpio.length > max) return en ? `${campo.en} allows up to ${max} characters.` : `${campo.es} admite máximo ${max} caracteres.`;
  return null;
}

export function errorTelefono(valor: string, idioma: Idioma, o: { obligatorio?: boolean } = {}): string | null {
  const en = idioma === "en";
  const digitos = limpiarTelefono(valor);
  if (!digitos) return o.obligatorio ? (en ? "The phone is required." : "El teléfono es obligatorio.") : null;
  return digitos.length === 10 ? null : en ? "The phone must have 10 digits." : "El teléfono debe tener 10 dígitos.";
}

export function errorCodigoPostal(valor: string, idioma: Idioma): string | null {
  const limpio = valor.trim();
  if (!limpio || /^\d{5}$/.test(limpio)) return null;
  return idioma === "en" ? "The ZIP code must have 5 digits." : "El código postal debe tener 5 dígitos.";
}

export function errorUrl(valor: string, campo: { es: string; en: string }, idioma: Idioma, o: { soloHttps?: boolean } = {}): string | null {
  const largo = errorTexto(valor, campo, LIMITES.url, idioma);
  if (largo) return largo;
  const limpio = valor.trim();
  if (!limpio) return null;
  const esquema = o.soloHttps ? /^https:\/\/\S+$/i : /^https?:\/\/\S+$/i;
  if (esquema.test(limpio)) return null;
  const en = idioma === "en";
  return o.soloHttps
    ? en
      ? `${campo.en} must start with https://`
      : `${campo.es} debe empezar con https://`
    : en
      ? `${campo.en} must start with http:// or https://`
      : `${campo.es} debe empezar con http:// o https://`;
}

export function errorCorreo(valor: string, idioma: Idioma): string | null {
  const largo = errorTexto(valor, { es: "El correo", en: "The email" }, LIMITES.correo, idioma);
  if (largo) return largo;
  const limpio = valor.trim();
  if (!limpio || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio)) return null;
  return idioma === "en" ? "The email isn't valid." : "El correo no es válido.";
}

/** Número opcional (vacío = sin valor) dentro de un rango. */
export function errorRango(
  valor: string,
  campo: { es: string; en: string },
  min: number,
  max: number,
  idioma: Idioma,
  o: { entero?: boolean; obligatorio?: boolean; minimoExclusivo?: boolean } = {},
): string | null {
  const en = idioma === "en";
  const limpio = valor.trim();
  if (!limpio) return o.obligatorio ? (en ? `${campo.en} is required.` : `${campo.es} es obligatorio.`) : null;
  const n = Number(limpio);
  if (!Number.isFinite(n) || (o.entero && !Number.isInteger(n))) {
    return en ? `${campo.en} isn't a valid number.` : `${campo.es} no es un número válido.`;
  }
  const bajo = o.minimoExclusivo ? n <= min : n < min;
  if (bajo || n > max) {
    if (o.minimoExclusivo) return en ? `${campo.en} must be greater than ${min} and at most ${max}.` : `${campo.es} debe ser mayor a ${min} y de máximo ${max}.`;
    return en ? `${campo.en} must be between ${min} and ${max}.` : `${campo.es} debe estar entre ${min} y ${max}.`;
  }
  return null;
}

/** El primer error de la lista, o null si todo sirve. */
export function primerError(...errores: Array<string | null>): string | null {
  return errores.find((e) => e) ?? null;
}
