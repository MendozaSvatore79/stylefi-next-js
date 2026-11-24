import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { PESTANAS_ADMIN, pestanaAdmin, rutaDePestana } from "@/lib/pestanas-admin";

const leer = (ruta: string) => readFileSync(join(__dirname, "..", ruta), "utf8");
const pagina = leer("app/(con-sesion)/dashboard/admin/page.tsx");
const shell = leer("components/admin-dashboard-shell.tsx");

describe("pestañas del panel de administración", () => {
  it("lee la pestaña de ?pestana= y abre el resumen con valores desconocidos o sin parámetro", () => {
    for (const p of PESTANAS_ADMIN) expect(pestanaAdmin(p)).toBe(p);
    expect(pestanaAdmin(null)).toBe("resumen");
    expect(pestanaAdmin(undefined)).toBe("resumen");
    expect(pestanaAdmin("")).toBe("resumen");
    expect(pestanaAdmin("metricas")).toBe("resumen");
    expect(pestanaAdmin("USUARIOS")).toBe("resumen");
  });

  it("arma la URL de cada pestaña; el resumen es la raíz sin parámetro", () => {
    expect(rutaDePestana("resumen")).toBe("/dashboard/admin");
    expect(rutaDePestana("usuarios")).toBe("/dashboard/admin?pestana=usuarios");
    for (const p of PESTANAS_ADMIN) expect(pestanaAdmin(new URL(rutaDePestana(p), "http://x").searchParams.get("pestana"))).toBe(p);
  });
});

describe("la página sigue a la URL (el menú lateral cambia de pestaña)", () => {
  it("las pestañas son controladas por ?pestana=, no abren siempre en resumen", () => {
    expect(pagina).toContain('pestanaAdmin(useSearchParams().get("pestana"))');
    expect(pagina).toMatch(/<Tabs\s+value=\{pestana\}/);
    expect(pagina).not.toContain('defaultValue="resumen"');
  });

  it("al hacer clic en una pestaña se actualiza la URL", () => {
    expect(pagina).toMatch(/onValueChange=\{\(valor\) => window\.history\.pushState\(null, "", rutaDePestana\(pestanaAdmin\(valor\)\)\)\}/);
  });

  it("cada pestaña de la página tiene su TabsTrigger y su TabsContent", () => {
    for (const p of PESTANAS_ADMIN) {
      expect(pagina).toContain(`<TabsTrigger value="${p}"`);
      expect(pagina).toContain(`<TabsContent value="${p}"`);
    }
  });
});

describe("menú lateral del admin", () => {
  it("tiene un enlace por pestaña, más Soporte, y ninguno a un # que no cambiaría la pestaña", () => {
    // Solo las líneas activas de navItems: un elemento comentado no cuenta como presente
    const inicio = shell.indexOf("const navItems: NavItem[] = [");
    expect(inicio).toBeGreaterThan(-1);
    const menu = shell
      .slice(inicio, shell.indexOf("];", inicio))
      .split("\n")
      .filter((linea) => !linea.trim().startsWith("//"))
      .join("\n");
    for (const p of PESTANAS_ADMIN) expect(menu).toMatch(new RegExp(`^\\s*deLaPestana\\("${p}"`, "m"));
    expect(menu).toContain('href: "/dashboard/admin/soporte"');
    expect(shell).not.toMatch(/href:\s*"\/dashboard\/admin#/);
  });

  it("resalta el elemento según ?pestana= y no solo por la ruta", () => {
    expect(shell).toContain('pestanaAdmin(useSearchParams().get("pestana"))');
    expect(shell).toContain('activePath === "/dashboard/admin" && pestanaActual === item.pestana');
  });

  it("los textos del menú y del marco van en español e inglés", () => {
    expect(shell).toContain("useLanguage()");
    expect(shell).toContain("{item.label[language]}");
    expect(shell).not.toMatch(/label:\s*"/);
    // Sin textos sueltos en español como hijos de JSX (todo va por TEXTOS[...][language])
    expect(shell).not.toMatch(/>\s*(Resumen|Alertas|Cancelar|Ir al sitio|Panel oficial|Administración|Operativo)\s*</);
    expect(shell).not.toMatch(/aria-label="[^"]+"/);
  });
});
