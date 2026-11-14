import { describe, expect, it, vi } from "vitest";

import { crearIdiomaGuardado, IDIOMA_POR_OMISION } from "@/lib/idioma-guardado";

function almacenFalso(inicial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(inicial));
  return {
    getItem: (clave: string) => datos.get(clave) ?? null,
    setItem: (clave: string, valor: string) => void datos.set(clave, valor),
    datos,
  };
}

describe("idioma guardado", () => {
  it("sin nada guardado (o en el servidor, sin almacén) usa español", () => {
    expect(IDIOMA_POR_OMISION).toBe("es");
    expect(crearIdiomaGuardado(() => almacenFalso()).leer()).toBe("es");
    expect(crearIdiomaGuardado(() => null).leer()).toBe("es");
  });

  it("si la persona eligió inglés, lo lee del almacén", () => {
    expect(crearIdiomaGuardado(() => almacenFalso({ language: "en" })).leer()).toBe("en");
  });

  it("un valor que no es idioma se ignora", () => {
    expect(crearIdiomaGuardado(() => almacenFalso({ language: "fr" })).leer()).toBe("es");
  });

  it("guardar escribe en el almacén y avisa a quien escucha; al desuscribirse ya no avisa", () => {
    const almacen = almacenFalso();
    const idioma = crearIdiomaGuardado(() => almacen);
    const avisar = vi.fn();
    const quitar = idioma.suscribir(avisar);
    idioma.guardar("en");
    expect(almacen.datos.get("language")).toBe("en");
    expect(idioma.leer()).toBe("en");
    expect(avisar).toHaveBeenCalledTimes(1);
    quitar();
    idioma.guardar("es");
    expect(avisar).toHaveBeenCalledTimes(1);
  });

  it("si el navegador no deja leer ni guardar (modo privado), el idioma elegido queda en memoria", () => {
    const roto = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    const idioma = crearIdiomaGuardado(() => roto);
    expect(idioma.leer()).toBe("es");
    const avisar = vi.fn();
    idioma.suscribir(avisar);
    idioma.guardar("en");
    expect(idioma.leer()).toBe("en");
    expect(avisar).toHaveBeenCalledTimes(1);
  });
});
