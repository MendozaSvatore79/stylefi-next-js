/** Ubicación de sucursales: funciones de lib/ubicacion.ts y guardia sobre la pantalla (no hay pruebas de componentes). */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  aplicarDireccion,
  coordenadasValidas,
  leerJson,
  mensajeErrorUbicacion,
  NO_DISPONIBLE,
  obtenerPosicion,
  OPCIONES_APROXIMADAS,
  OPCIONES_PRECISAS,
  PERMISO_NEGADO,
  TIEMPO_AGOTADO,
} from "@/lib/ubicacion";

describe("coordenadasValidas", () => {
  it("vacías, con espacios o a medias no son 0,0", () => {
    expect(coordenadasValidas("", "")).toBeNull();
    expect(coordenadasValidas("  ", " ")).toBeNull();
    expect(coordenadasValidas("19.4", "")).toBeNull();
    expect(coordenadasValidas("", "-99.1")).toBeNull();
  });

  it("texto que no es número o fuera de rango: null", () => {
    expect(coordenadasValidas("abc", "1")).toBeNull();
    expect(coordenadasValidas("1", "Infinity")).toBeNull();
    expect(coordenadasValidas("90.0001", "0")).toBeNull();
    expect(coordenadasValidas("-90.0001", "0")).toBeNull();
    expect(coordenadasValidas("0", "180.0001")).toBeNull();
    expect(coordenadasValidas("0", "-180.0001")).toBeNull();
  });

  it("válidas (incluidos los bordes y 0 escrito a mano)", () => {
    expect(coordenadasValidas(" 19.4326 ", "-99.1332")).toEqual({ latitude: 19.4326, longitude: -99.1332 });
    expect(coordenadasValidas("90", "-180")).toEqual({ latitude: 90, longitude: -180 });
    expect(coordenadasValidas("-90", "180")).toEqual({ latitude: -90, longitude: 180 });
    expect(coordenadasValidas("0", "0")).toEqual({ latitude: 0, longitude: 0 });
  });
});

describe("mensajeErrorUbicacion", () => {
  it("un mensaje distinto por cada causa, en español", () => {
    const mensajes = [
      mensajeErrorUbicacion(PERMISO_NEGADO, true, "es"),
      mensajeErrorUbicacion(NO_DISPONIBLE, true, "es"),
      mensajeErrorUbicacion(TIEMPO_AGOTADO, true, "es"),
      mensajeErrorUbicacion(undefined, true, "es"),
      mensajeErrorUbicacion(PERMISO_NEGADO, false, "es"),
    ];
    expect(new Set(mensajes).size).toBe(5);
    expect(mensajes[0]).toContain("permiso de ubicación está bloqueado");
    expect(mensajes[1]).toContain("localización esté activada");
    expect(mensajes[2]).toContain("tardó demasiado");
    expect(mensajes[4]).toContain("conexión segura");
  });

  it("fuera de un origen seguro manda el mensaje de conexión, no el de permiso", () => {
    expect(mensajeErrorUbicacion(PERMISO_NEGADO, false, "es")).toBe(mensajeErrorUbicacion(TIEMPO_AGOTADO, false, "es"));
    expect(mensajeErrorUbicacion(PERMISO_NEGADO, false, "en")).toContain("secure connection");
  });

  it("en inglés", () => {
    expect(mensajeErrorUbicacion(PERMISO_NEGADO, true, "en")).toContain("permission is blocked");
    expect(mensajeErrorUbicacion(TIEMPO_AGOTADO, true, "en")).toContain("took too long");
  });
});

type Llamada = { opciones?: PositionOptions };
function geoFalso(respuestas: Array<{ codigo: number } | { lat: number; lng: number }>) {
  const llamadas: Llamada[] = [];
  const geo = {
    getCurrentPosition: (ok: PositionCallback, falla?: PositionErrorCallback | null, opciones?: PositionOptions) => {
      llamadas.push({ opciones });
      const r = respuestas[llamadas.length - 1];
      if ("codigo" in r) falla?.({ code: r.codigo } as GeolocationPositionError);
      else ok({ coords: { latitude: r.lat, longitude: r.lng } } as GeolocationPosition);
    },
  };
  return { geo, llamadas };
}

describe("obtenerPosicion", () => {
  it("primero alta precisión; si responde, no hay segundo intento", async () => {
    const { geo, llamadas } = geoFalso([{ lat: 19.4, lng: -99.1 }]);
    expect((await obtenerPosicion(geo)).coords.latitude).toBe(19.4);
    expect(llamadas).toEqual([{ opciones: OPCIONES_PRECISAS }]);
    expect(OPCIONES_PRECISAS.enableHighAccuracy).toBe(true);
  });

  it("si se agota el tiempo, reintenta en baja precisión", async () => {
    const { geo, llamadas } = geoFalso([{ codigo: TIEMPO_AGOTADO }, { lat: 20, lng: -100 }]);
    expect((await obtenerPosicion(geo)).coords.longitude).toBe(-100);
    expect(llamadas.map((l) => l.opciones)).toEqual([OPCIONES_PRECISAS, OPCIONES_APROXIMADAS]);
    expect(OPCIONES_APROXIMADAS.enableHighAccuracy).toBe(false);
  });

  it("permiso negado o no disponible: no reintenta y propaga el código", async () => {
    for (const codigo of [PERMISO_NEGADO, NO_DISPONIBLE]) {
      const { geo, llamadas } = geoFalso([{ codigo }, { lat: 1, lng: 1 }]);
      await expect(obtenerPosicion(geo)).rejects.toMatchObject({ code: codigo });
      expect(llamadas).toHaveLength(1);
    }
  });

  it("si el segundo intento también falla, propaga su error", async () => {
    const { geo } = geoFalso([{ codigo: TIEMPO_AGOTADO }, { codigo: NO_DISPONIBLE }]);
    await expect(obtenerPosicion(geo)).rejects.toMatchObject({ code: NO_DISPONIBLE });
  });
});

describe("leerJson y aplicarDireccion", () => {
  it("un cuerpo que no es JSON (o no es objeto) da {}", async () => {
    expect(await leerJson(new Response("<html>502</html>", { status: 502 }))).toEqual({});
    expect(await leerJson(Response.json(null))).toEqual({});
    expect(await leerJson(Response.json({ error: "x" }))).toEqual({ error: "x" });
  });

  const form = { branchName: "Centro", address: "Escrita", city: "", state: "Jal", postalCode: "" };

  it("llena lo que trae dato y conserva lo demás", () => {
    const r = aplicarDireccion(form, { address: " Av. Reforma 222 ", city: "CDMX", state: "", postalCode: 6600 });
    expect(r.llenados).toBe(2);
    expect(r.form).toEqual({ branchName: "Centro", address: "Av. Reforma 222", city: "CDMX", state: "Jal", postalCode: "" });
    expect(form.address).toBe("Escrita");
  });

  it("sin ningún dato: 0 llenados y el formulario igual (no es éxito)", () => {
    for (const datos of [{}, { address: "", city: " ", state: "", postalCode: "" }, { error: "Unable to geocode" }]) {
      const r = aplicarDireccion(form, datos);
      expect(r.llenados).toBe(0);
      expect(r.form).toEqual(form);
    }
  });

  it("los cuatro campos cuentan", () => {
    expect(aplicarDireccion(form, { address: "a", city: "b", state: "c", postalCode: "d" }).llenados).toBe(4);
  });
});

describe("pantalla de Sucursales", () => {
  const fuente = readFileSync(path.resolve(import.meta.dirname, "..", "app/dashboard/negocio/sucursales/page.tsx"), "utf8");

  it("no pide la ubicación al abrirse: solo el botón llama a requestCurrentLocation", () => {
    expect(fuente.match(/requestCurrentLocation\(/g)).toHaveLength(1);
    expect(fuente).toContain("onClick={() => void requestCurrentLocation()}");
    const efectos = [...fuente.matchAll(/useEffect\(\(\) => \{([^}]*)\}/g)].map((m) => m[1]);
    expect(efectos.length).toBeGreaterThan(0);
    for (const cuerpo of efectos) expect(cuerpo).not.toMatch(/Location|geolocation/);
  });

  it("usa las funciones de lib/ubicacion y no convierte coordenadas con Number() sin validar", () => {
    for (const fn of ["obtenerPosicion(navigator.geolocation)", "coordenadasValidas(form.latitude, form.longitude)", "leerJson(response)", "mensajeErrorUbicacion("]) {
      expect(fuente).toContain(fn);
    }
    expect(fuente).not.toContain("Number(form.latitude)");
    expect(fuente).not.toContain("getCurrentPosition");
    // Un 200 sin datos se trata como error, no como "Dirección actualizada"
    expect(fuente).toMatch(/if \(aplicarDireccion\(form, datos\)\.llenados === 0\) \{\s+return /);
  });

  it("tiene una línea de estado anunciada a lectores de pantalla", () => {
    expect(fuente).toMatch(/role="status"\s+aria-live="polite"/);
    expect(fuente).toContain("{estadoUbicacion?.texto");
  });
});
