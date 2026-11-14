/**
 * Ubicación de una sucursal: coordenadas del navegador y dirección a partir de ellas (GET /geocode/reverse del
 * backend). Funciones sin React para poder probarlas; la pantalla de Sucursales solo las conecta con el formulario.
 */

export type Idioma = "es" | "en";

export type Coordenadas = { latitude: number; longitude: number };

export type CamposDireccion = { address: string; city: string; state: string; postalCode: string };

const CAMPOS: Array<keyof CamposDireccion> = ["address", "city", "state", "postalCode"];

/**
 * Coordenadas escritas en el formulario, o null si no sirven. Un campo vacío no es 0: Number("") daría 0 y se
 * buscaría la dirección de 0,0 (en el mar).
 */
export function coordenadasValidas(latitud: string, longitud: string): Coordenadas | null {
  const lat = latitud.trim();
  const lng = longitud.trim();
  if (!lat || !lng) return null;
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

/** Códigos de GeolocationPositionError. */
export const PERMISO_NEGADO = 1;
export const NO_DISPONIBLE = 2;
export const TIEMPO_AGOTADO = 3;

/**
 * Mensaje para la persona según el error del navegador. Fuera de un origen seguro (https o localhost; por ejemplo
 * el celular entrando por la IP de la red local) el navegador responde "permiso negado" aunque nadie lo negó.
 */
export function mensajeErrorUbicacion(codigo: number | undefined, origenSeguro: boolean, idioma: Idioma): string {
  const en = idioma === "en";
  if (!origenSeguro) {
    return en
      ? "Location only works over a secure connection (https or localhost). Enter the coordinates manually."
      : "La ubicación solo funciona en una conexión segura (https o localhost). Escribe las coordenadas a mano.";
  }
  if (codigo === PERMISO_NEGADO) {
    return en
      ? "Location permission is blocked. Allow it in your browser's site settings and try again."
      : "El permiso de ubicación está bloqueado. Permítelo en la configuración del sitio de tu navegador e intenta de nuevo.";
  }
  if (codigo === NO_DISPONIBLE) {
    return en
      ? "Your device could not determine the location. Check that location services are on for your browser."
      : "Tu equipo no pudo determinar la ubicación. Revisa que la localización esté activada para tu navegador.";
  }
  if (codigo === TIEMPO_AGOTADO) {
    return en
      ? "Getting your location took too long. Try again or enter the coordinates manually."
      : "Obtener tu ubicación tardó demasiado. Intenta de nuevo o escribe las coordenadas a mano.";
  }
  return en
    ? "Could not get your location. You can enter the coordinates manually."
    : "No se pudo obtener tu ubicación. Puedes escribir las coordenadas a mano.";
}

/** Primer intento: GPS o Wi-Fi preciso. */
export const OPCIONES_PRECISAS: PositionOptions = { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 };
/** Si el primero se agota (frecuente en computadoras de escritorio): ubicación aproximada, que suele ser inmediata. */
export const OPCIONES_APROXIMADAS: PositionOptions = { enableHighAccuracy: false, timeout: 15_000, maximumAge: 300_000 };

type Geolocalizacion = Pick<Geolocation, "getCurrentPosition">;

function pedirPosicion(geo: Geolocalizacion, opciones: PositionOptions) {
  return new Promise<GeolocationPosition>((resolve, reject) => geo.getCurrentPosition(resolve, reject, opciones));
}

/** Posición actual: alta precisión y, solo si se agota el tiempo, un segundo intento en baja precisión. */
export async function obtenerPosicion(geo: Geolocalizacion): Promise<GeolocationPosition> {
  try {
    return await pedirPosicion(geo, OPCIONES_PRECISAS);
  } catch (error) {
    if ((error as GeolocationPositionError | undefined)?.code !== TIEMPO_AGOTADO) throw error;
    return pedirPosicion(geo, OPCIONES_APROXIMADAS);
  }
}

/** Cuerpo JSON de una respuesta, o {} si no es JSON (un proxy, una página de error). */
export async function leerJson(respuesta: Response): Promise<Record<string, unknown>> {
  try {
    const datos: unknown = await respuesta.json();
    return datos && typeof datos === "object" ? (datos as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Llena los campos de dirección con lo que vino del backend; los que vengan vacíos conservan lo que ya había.
 * `llenados` dice cuántos campos trajeron dato: con 0 no hay nada que anunciar como éxito.
 */
export function aplicarDireccion<T extends CamposDireccion>(form: T, datos: Record<string, unknown>): { form: T; llenados: number } {
  const nuevo = { ...form };
  let llenados = 0;
  for (const campo of CAMPOS) {
    const valor = datos[campo];
    if (typeof valor === "string" && valor.trim()) {
      nuevo[campo] = valor.trim() as T[typeof campo];
      llenados += 1;
    }
  }
  return { form: nuevo, llenados };
}
