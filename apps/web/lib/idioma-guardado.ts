/**
 * Idioma elegido por la persona, guardado en localStorage. Sin React, para usarlo con useSyncExternalStore
 * (y probarlo en Node). En el servidor no hay almacén: se usa el idioma por omisión.
 */
export type Language = "es" | "en";

export const IDIOMA_POR_OMISION: Language = "es";
const CLAVE = "language";

type Almacen = Pick<Storage, "getItem" | "setItem">;

const esIdioma = (valor: unknown): valor is Language => valor === "es" || valor === "en";

export function crearIdiomaGuardado(obtenerAlmacen: () => Almacen | null) {
  // Si el navegador no deja guardar (modo privado, almacén lleno), el idioma elegido vive en memoria.
  let enMemoria: Language | null = null;
  const oyentes = new Set<() => void>();

  return {
    leer(): Language {
      if (enMemoria) return enMemoria;
      try {
        const guardado = obtenerAlmacen()?.getItem(CLAVE);
        if (esIdioma(guardado)) return guardado;
      } catch {
        // Sin acceso al almacén: idioma por omisión.
      }
      return IDIOMA_POR_OMISION;
    },
    guardar(idioma: Language) {
      enMemoria = idioma;
      try {
        obtenerAlmacen()?.setItem(CLAVE, idioma);
      } catch {
        // Queda en memoria durante la visita.
      }
      oyentes.forEach((avisar) => avisar());
    },
    suscribir(avisar: () => void) {
      oyentes.add(avisar);
      return () => {
        oyentes.delete(avisar);
      };
    },
  };
}
