/** Correcciones de la revisión 4 (accesibilidad, favicon y ajustes que no guardaban nada). */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const RAIZ = path.resolve(import.meta.dirname, "..");
const leer = (archivo: string) => readFileSync(path.resolve(RAIZ, archivo), "utf8");

describe("configuración del cliente", () => {
  it("ya no ofrece interruptores de privacidad que no guardaban nada (perfil público, historial, análisis)", () => {
    const pagina = leer("app/dashboard/cliente/configuracion/page.tsx");
    expect(pagina).not.toMatch(/privacy/);
    expect(pagina).toContain('useState<"general" | "security" | "notifications">("general")');
    expect(leer("lib/language-context.tsx")).not.toMatch(/"(settings\.privacy|privacy\.(title|description|profile|history|analytics))/);
  });
});

describe("favicon", () => {
  it("es un .ico real con 16, 32 y 48 px y pesa menos de 16 KB (antes, un PNG de 500×500 de 162 KB)", () => {
    const ico = readFileSync(path.resolve(RAIZ, "app/favicon.ico"));
    expect(ico.length).toBeLessThan(16 * 1024);
    expect([ico.readUInt16LE(0), ico.readUInt16LE(2)]).toEqual([0, 1]);
    const n = ico.readUInt16LE(4);
    const tamanos = Array.from({ length: n }, (_, i) => ico[6 + 16 * i] || 256);
    expect(tamanos).toEqual([16, 32, 48]);
  });
});

describe("botones de icono con nombre", () => {
  it("el botón de menú móvil del panel de admin se anuncia como «Abrir menú» (como en cliente y negocio)", () => {
    expect(leer("components/admin-dashboard-shell.tsx")).toContain(
      'onClick={() => setSidebarOpen(true)} aria-label="Abrir menú">',
    );
    for (const panel of ["business", "client"]) expect(leer(`components/${panel}-dashboard-shell.tsx`)).toContain('aria-label="Abrir menú"');
  });
});

/** Campos <input>/<textarea>/<select> sin etiqueta: ni dentro de <Campo>/<label>, ni con aria-label, ni con id ligado. */
function camposSinEtiqueta(fuente: string) {
  const fin = (i: number) => {
    let prof = 0;
    for (let j = i; j < fuente.length; j++) {
      const c = fuente[j];
      if (c === "{") prof++;
      else if (c === "}") prof--;
      else if (prof === 0 && (fuente.startsWith("/>", j) || c === ">")) return j + 1;
    }
    return fuente.length;
  };
  const abierto = (etiqueta: string, i: number) => {
    const a = fuente.lastIndexOf(`<${etiqueta}`, i);
    return a !== -1 && fuente.indexOf(`</${etiqueta}>`, a) > i;
  };
  const sin: string[] = [];
  for (const m of fuente.matchAll(/<(input|textarea|select)\b/g)) {
    const i = m.index!;
    const tag = fuente.slice(i, fin(i));
    if (/type="(checkbox|file|hidden|radio)"/.test(tag)) continue;
    if (/aria-label=/.test(tag)) continue;
    const id = tag.match(/\sid="([^"]+)"/)?.[1];
    if (id && fuente.includes(`htmlFor="${id}"`)) continue;
    if (abierto("Campo", i) || abierto("label", i)) continue;
    sin.push(`${fuente.slice(0, i).split("\n").length}: ${tag.replace(/\s+/g, " ").slice(0, 70)}`);
  }
  return sin;
}

describe("formularios con etiqueta visible y ligada (el placeholder solo desaparece al escribir)", () => {
  it.each([
    "app/dashboard/negocio/sucursales/page.tsx",
    "app/dashboard/negocio/servicios/page.tsx",
    "app/dashboard/negocio/estilistas/page.tsx",
    "app/dashboard/cliente/citas/page.tsx",
    "app/dashboard/cliente/pagos/page.tsx",
    "app/dashboard/cliente/configuracion/page.tsx",
    "app/dashboard/admin/soporte/page.tsx",
    "components/salon-discovery.tsx",
  ])("%s", (archivo) => {
    expect(camposSinEtiqueta(leer(archivo))).toEqual([]);
  });

  it("Campo envuelve el control en un <label> con el texto visible", () => {
    const campo = leer("components/campo.tsx");
    expect(campo).toMatch(/<label className=\{cn\("block min-w-0", className\)\}>\s+<span className="mb-1 block text-xs font-semibold text-slate-600">\{etiqueta\}<\/span>\s+\{children\}\s+<\/label>/);
  });
});
