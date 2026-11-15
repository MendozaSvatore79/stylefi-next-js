/**
 * Formulario de /registro/completar: legible con el sistema en modo oscuro, con label visible y ligado a cada campo
 * (Google precarga nombre y apellidos, y sin label solo quedaba el valor), y Nombre(s) antes que Apellido(s).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const fuente = readFileSync(path.resolve(import.meta.dirname, "../app/registro/completar/completar-registro.tsx"), "utf8");
const inputs = [...fuente.matchAll(/<input\b[^>]*\/>/g)].map((m) => m[0]);

describe("formulario de completar registro", () => {
  it("la clase de los campos fija texto oscuro y placeholder legible", () => {
    const campo = fuente.match(/const campo =\s*"([^"]+)"/)?.[1] ?? "";
    expect(campo.split(/\s+/)).toEqual(expect.arrayContaining(["bg-white", "text-slate-900", "placeholder:text-slate-400"]));
    for (const input of inputs) expect(input).toContain("className={campo}");
  });

  it("cada input tiene un <label> visible ligado por htmlFor/id, con el texto del campo", () => {
    const campos = [
      ["firstName", "t.nombre"],
      ["lastName", "t.apellidos"],
      ["businessName", "t.nombreNegocio"],
      ["rfc", "t.rfc"],
      ["phone", "t.telefono"],
    ] as const;
    expect(inputs).toHaveLength(campos.length);
    for (const [clave, texto] of campos) {
      const input = inputs.find((i) => i.includes(`cambiar("${clave}")`));
      expect(input, clave).toBeDefined();
      const id = input!.match(/\bid=\{`\$\{id\}-([a-z]+)`\}/)?.[1];
      expect(id, `id de ${clave}`).toBeTruthy();
      const label = fuente.match(new RegExp(`<label htmlFor=\\{\`\\$\\{id\\}-${id}\`\\} className=\\{etiqueta\\}>\\{([^}]+)\\}</label>`));
      expect(label?.[1], `label de ${clave}`).toBe(texto);
    }
    expect(new Set(inputs.map((i) => i.match(/\bid=\{`\$\{id\}-([a-z]+)`\}/)?.[1])).size).toBe(campos.length);
    expect(fuente).toMatch(/const etiqueta = "[^"]*\bblock\b[^"]*"/);
  });

  it("textos de las etiquetas en español e inglés", () => {
    for (const texto of ['nombre: "Nombre(s)"', 'apellidos: "Apellido(s)"', 'telefono: "Teléfono"', 'nombreNegocio: "Nombre del negocio"', 'rfc: "RFC"']) {
      expect(fuente).toContain(texto);
    }
    for (const texto of ['nombre: "First name(s)"', 'apellidos: "Last name(s)"', 'telefono: "Phone"', 'nombreNegocio: "Business name"', 'rfc: "Tax ID (RFC)"']) {
      expect(fuente).toContain(texto);
    }
  });

  it("Nombre(s) (firstName) va antes —a la izquierda— que Apellido(s) (lastName)", () => {
    const orden = inputs.map((i) => i.match(/cambiar\("(\w+)"\)/)?.[1]);
    expect(orden.indexOf("firstName")).toBe(0);
    expect(orden.indexOf("lastName")).toBe(1);
  });
});
