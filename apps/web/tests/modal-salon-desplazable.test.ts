import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const modal = readFileSync(path.resolve(import.meta.dirname, "..", "components/salon-modal.tsx"), "utf8");

describe("modal del salón: el contenido se desplaza y «Agendar cita» queda a la vista", () => {
  it("la cadena de contenedores usa flex-1 min-h-0 (no h-full sobre un padre sin altura)", () => {
    expect(modal).toContain('<div className="flex min-h-0 flex-1 flex-col p-6 sm:p-8">');
    expect(modal).toContain('<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">');
    expect(modal).toContain('<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2">');
    expect(modal).toContain('<div ref={bookingScrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain pl-0 pr-1">');
    expect(modal).not.toMatch(/className="h-full overflow-(y-auto|hidden)/);
  });

  it("los botones Cerrar / Agendar cita van fijos al fondo (sticky)", () => {
    expect(modal).toMatch(/<div className="sticky bottom-0 [^"]*grid grid-cols-2[^"]*">\s*<button\s+onClick=\{onClose\}/);
  });
});
