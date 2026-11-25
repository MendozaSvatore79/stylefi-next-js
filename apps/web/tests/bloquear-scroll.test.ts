import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { bloquearFondo } from "@/lib/bloquear-scroll";

type Nodo = { nombre: string; overflowY: string; style: { overflow: string }; parentElement: Nodo | null };
const nodo = (nombre: string, overflowY: string, padre: Nodo | null, overflowInicial = ""): Nodo => ({ nombre, overflowY, style: { overflow: overflowInicial }, parentElement: padre });

describe("bloquearFondo", () => {
  const raiz = nodo("html", "visible", null, "");
  const panel = nodo("section", "auto", raiz, "");
  const tarjeta = nodo("div", "visible", panel, "");
  const lista = nodo("div", "scroll", tarjeta, "clip");
  const modal = nodo("modal", "auto", lista);

  it("bloquea cada ancestro que se desplaza y la raíz; los demás no se tocan", () => {
    const restaurar = bloquearFondo(modal, raiz, (n) => (n as Nodo).overflowY);
    expect(panel.style.overflow).toBe("hidden");
    expect(lista.style.overflow).toBe("hidden");
    expect(raiz.style.overflow).toBe("hidden");
    expect(tarjeta.style.overflow).toBe("");
    expect(modal.style.overflow).toBe("");
    restaurar();
    expect(panel.style.overflow).toBe("");
    expect(lista.style.overflow).toBe("clip");
    expect(raiz.style.overflow).toBe("");
  });
});

describe("el modal del salón bloquea el fondo y contiene el desplazamiento", () => {
  const modal = readFileSync(path.resolve(import.meta.dirname, "..", "components/salon-modal.tsx"), "utf8");
  it("usa el hook con la raíz del modal en sus tres variantes", () => {
    expect(modal).toContain("useBloquearScrollDeFondo(raizRef);");
    expect(modal.match(/<div ref=\{raizRef\} className="fixed inset-0[^"]*overscroll-contain/g)).toHaveLength(3);
  });
  it("las zonas que se desplazan contienen el movimiento (no pasa al fondo)", () => {
    expect(modal).toContain("min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2");
    expect(modal).toContain("min-h-0 flex-1 overflow-y-auto overscroll-contain pl-0 pr-1");
  });
});
