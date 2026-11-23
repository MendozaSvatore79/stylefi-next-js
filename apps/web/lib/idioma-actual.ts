import { useSyncExternalStore } from "react";

import { crearIdiomaGuardado, IDIOMA_POR_OMISION, type Language } from "@/lib/idioma-guardado";

/**
 * Idioma guardado en este navegador, compartido por LanguageProvider y por las pantallas que viven fuera de él
 * (app/global-error.tsx reemplaza el layout raíz y no tiene proveedores). Separado del diccionario para que esas
 * pantallas no carguen todas las traducciones.
 */
export const idiomaGuardado = crearIdiomaGuardado(() => (typeof window === "undefined" ? null : window.localStorage));

/** Idioma actual: el servidor y la hidratación usan el idioma por omisión; después, el guardado. */
export function useIdiomaActual(): Language {
  return useSyncExternalStore(idiomaGuardado.suscribir, idiomaGuardado.leer, () => IDIOMA_POR_OMISION);
}
