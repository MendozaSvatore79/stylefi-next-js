/**
 * Estado derivado sin setState en un efecto (regla react-hooks/set-state-in-effect). Los archivos ya corregidos no
 * deben volver a tener el aviso; la regla sigue en "warn" mientras queden cargas de datos por migrar.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const RAIZ = path.resolve(import.meta.dirname, "..");
const leer = (archivo: string) => readFileSync(path.resolve(RAIZ, archivo), "utf8");

const CORREGIDOS = [
  "components/admin-dashboard-shell.tsx",
  "components/business-dashboard-shell.tsx",
  "components/client-dashboard-shell.tsx",
  "components/salon-modal.tsx",
  "components/time-slot-picker.tsx",
];

describe("sin setState en efectos", () => {
  it("los archivos corregidos no tienen el aviso", async () => {
    const resultados = await new ESLint({ cwd: RAIZ }).lintFiles(CORREGIDOS);
    const avisos = resultados.flatMap((r) =>
      r.messages
        .filter((m) => m.ruleId === "react-hooks/set-state-in-effect")
        .map((m) => `${path.relative(RAIZ, r.filePath)}:${m.line}`),
    );
    expect(avisos).toEqual([]);
  }, 60_000);
});

describe("menú del avatar en los paneles", () => {
  it.each(["admin", "business", "client"])("%s: se cierra al cambiar de ruta porque recuerda dónde se abrió", (panel) => {
    const fuente = leer(`components/${panel}-dashboard-shell.tsx`);
    expect(fuente).toContain("const avatarMenuOpen = menuAbiertoEn === pathname;");
    expect(fuente).toContain("setMenuAbiertoEn((abiertoEn) => (abiertoEn === pathname ? null : pathname))");
  });
});

describe("modal del salón", () => {
  it("si el servicio ya no está en la sucursal se vuelve a elegir, ajustado en el render y no en un efecto", () => {
    const fuente = leer("components/salon-modal.tsx");
    expect(fuente).toMatch(
      /const servicioFueraDeSucursal =\s+bookingForm\.serviceId !== "" && !servicesForBranch\.some\(\(service\) => service\.id === bookingForm\.serviceId\);\s+if \(servicioFueraDeSucursal\) \{\s+setBookingForm\(\(current\) => \(\{ \.\.\.current, serviceId: "", scheduledAt: "" \}\)\);\s+setBookingDate\(""\);\s+setBookingStep\("details"\);/,
    );
  });
});

describe("selector de horarios", () => {
  const fuente = leer("components/time-slot-picker.tsx");

  it("sin negocio, servicio o fecha no muestra horarios (derivado, sin setSlots([]))", () => {
    expect(fuente).not.toContain("setSlots([])");
    expect(fuente).toContain("const visibles = faltanDatos ? [] : slots;");
    expect(fuente).toContain("{visibles.map((slot) => (");
  });

  it("una respuesta vieja no pisa los horarios de la fecha nueva", () => {
    expect(fuente).toMatch(/const payload = [^\n]+\n\s+if \(!vigente\) \{\s+return;\s+\}\s+setSlots\(/);
    expect(fuente).toMatch(/return \(\) => \{\s+vigente = false;\s+\};/);
  });
});

describe("widget de soporte (AURA)", () => {
  const archivo = "components/oracle-support-widget.tsx";
  const fuente = leer(archivo);

  it("el único setState en un efecto que queda es la consulta del ticket (carga de datos)", async () => {
    const [resultado] = await new ESLint({ cwd: RAIZ }).lintFiles([archivo]);
    const lineas = fuente.split("\n");
    const avisos = resultado.messages
      .filter((m) => m.ruleId === "react-hooks/set-state-in-effect")
      .map((m) => lineas[m.line - 1].trim());
    expect(avisos).toEqual(["void refreshTicket(ticketId);"]);
  }, 60_000);

  it("el ticket guardado se lee con useSyncExternalStore y la app puede elegir otro u olvidarlo", () => {
    expect(fuente).toContain("useSyncExternalStore(suscribirAlmacen, leerTicketGuardado, () => null)");
    expect(fuente).toContain("const ticketId = ticketElegido === undefined ? ticketGuardado : ticketElegido;");
  });

  it("fuera de las rutas permitidas se cierra en el render", () => {
    expect(fuente).toMatch(/if \(!isAllowed && open\) \{\s+setOpen\(false\);\s+\}/);
  });

  it("los datos de contacto no se copian de la sesión (al salir quedaban los de la persona anterior)", () => {
    expect(fuente).not.toMatch(/setContactName\(displayName\)|setContactEmail\(displayEmail\)/);
  });
});
