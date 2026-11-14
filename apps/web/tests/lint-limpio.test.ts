/**
 * Guardias de la limpieza de lint (rama lint-limpio). No hay pruebas de componentes en el proyecto:
 * el comportamiento se comprueba en el navegador; esto evita que vuelvan los patrones corregidos.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const leer = (archivo: string) => readFileSync(path.resolve(import.meta.dirname, "..", archivo), "utf8");

describe("bienvenida de la plataforma", () => {
  it("los pasos se arman en cada render con `t`, para que sigan el idioma (antes: useMemo con [isClient])", () => {
    const fuente = leer("components/platform-onboarding-modal.tsx");
    expect(fuente).not.toMatch(/useMemo\(|import \{[^}]*useMemo/);
    expect(fuente).toMatch(/const steps =\s+isClient/);
  });
});

describe("modal del salón", () => {
  it("los servicios de la sucursal usan su tipo (Service), sin `any`", () => {
    const fuente = leer("components/salon-modal.tsx");
    expect(fuente).not.toMatch(/:\s*any\b/);
    expect(fuente).toContain("servicesForBranch.map((service) => (");
  });
});

describe("idioma", () => {
  it("el proveedor lee el idioma con useSyncExternalStore (sin setState en un efecto) y el servidor usa el de omisión", () => {
    const fuente = leer("lib/language-context.tsx");
    expect(fuente).not.toMatch(/useEffect|useState/);
    expect(fuente).toContain("useSyncExternalStore(idiomaGuardado.suscribir, idiomaGuardado.leer, () => IDIOMA_POR_OMISION)");
  });
});

describe("dependencias de los efectos sin repetir llamadas", () => {
  it("`t` y el valor del contexto de idioma son estables mientras no cambie el idioma", () => {
    const fuente = leer("lib/language-context.tsx");
    expect(fuente).toMatch(/const t = useCallback\([\s\S]*?\[language\]\);/);
    expect(fuente).toContain("useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t])");
    expect(fuente).toContain("value={valor}");
  });

  it("Pagos: los métodos se cargan con un loadMethods estable y la recarga se confirma una sola vez por sesión", () => {
    const fuente = leer("app/dashboard/cliente/pagos/page.tsx");
    expect(fuente).toMatch(/const loadMethods = useCallback\([\s\S]*?\}, \[showToast\]\);/);
    expect(fuente).toContain("}, [loadMethods]);");
    expect(fuente).toMatch(/if \(confirmandoSesionRef\.current === sessionId\) \{\s*return;\s*\}\s*confirmandoSesionRef\.current = sessionId;/);
    expect(fuente).toContain("}, [confirmedSessionId, loadMethods, showToast, t]);");
  });
});
