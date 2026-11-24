import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  consultaDeCitas,
  consultaDeNegocios,
  nombreDeNegocio,
  rangoInicialDeCitas,
  rutaDeCitasDe,
} from "@/lib/admin-listas";

const leer = (ruta: string) => readFileSync(join(__dirname, "..", ruta), "utf8");
const negocios = leer("app/(con-sesion)/dashboard/admin/negocios/page.tsx");
const citas = leer("app/(con-sesion)/dashboard/admin/citas/page.tsx");
const panel = leer("app/(con-sesion)/dashboard/admin/page.tsx");
const shell = leer("components/admin-dashboard-shell.tsx");

const params = (r: ReturnType<typeof consultaDeCitas>) => {
  if (!("query" in r)) throw new Error(`se esperaba query y llegó ${JSON.stringify(r)}`);
  return Object.fromEntries(new URLSearchParams(r.query));
};

describe("consultaDeCitas: fechas de calendario en hora de México", () => {
  it("manda [inicio de desde, fin de hasta) como instantes (México es UTC-6)", () => {
    expect(params(consultaDeCitas({ desde: "2030-03-01", hasta: "2030-03-31" }))).toEqual({
      from: "2030-03-01T06:00:00.000Z",
      to: "2030-04-01T06:00:00.000Z",
    });
  });

  it("un solo día es un rango válido de 24 horas", () => {
    expect(params(consultaDeCitas({ desde: "2030-03-10", hasta: "2030-03-10" }))).toEqual({
      from: "2030-03-10T06:00:00.000Z",
      to: "2030-03-11T06:00:00.000Z",
    });
  });

  it("agrega negocio, sucursal, estado y página solo cuando aplican", () => {
    expect(
      params(
        consultaDeCitas({ desde: "2030-03-01", hasta: "2030-03-02", negocio: "n1", sucursal: "s1", estado: "cancelled", pagina: 3 }),
      ),
    ).toMatchObject({ businessId: "n1", branchId: "s1", status: "cancelled", page: "3" });
    const sinExtras = params(consultaDeCitas({ desde: "2030-03-01", hasta: "2030-03-02", negocio: null, estado: "all", pagina: 1 }));
    expect(Object.keys(sinExtras).sort()).toEqual(["from", "to"]);
  });

  it("valida antes de pedir: fechas vacías o inválidas, al revés, o más de 92 días", () => {
    expect(consultaDeCitas({ desde: "", hasta: "2030-03-01" })).toEqual({ error: "fecha" });
    expect(consultaDeCitas({ desde: "2030-02-30", hasta: "2030-03-01" })).toEqual({ error: "fecha" });
    expect(consultaDeCitas({ desde: "2030-03-02", hasta: "2030-03-01" })).toEqual({ error: "orden" });
    // 92 días contando el último completo: sí; 93: no
    expect("query" in consultaDeCitas({ desde: "2030-01-01", hasta: "2030-04-02" })).toBe(true);
    expect(consultaDeCitas({ desde: "2030-01-01", hasta: "2030-04-03" })).toEqual({ error: "rango" });
  });

  it("el rango inicial son 30 días a cada lado de hoy, en fecha de México", () => {
    // 03:00 UTC del 15 de junio todavía es 14 de junio en México
    expect(rangoInicialDeCitas(new Date("2030-06-15T03:00:00Z"))).toEqual({ desde: "2030-05-15", hasta: "2030-07-14" });
  });
});

describe("consultaDeNegocios, enlaces y nombres", () => {
  it("solo manda los filtros que aplican", () => {
    expect(consultaDeNegocios({})).toBe("");
    expect(consultaDeNegocios({ busqueda: "  ", estado: "all", pagina: 1 })).toBe("");
    expect(Object.fromEntries(new URLSearchParams(consultaDeNegocios({ busqueda: " zafiro ", estado: "pending", pagina: 2 })))).toEqual({
      search: "zafiro",
      status: "pending",
      page: "2",
    });
  });

  it("arma el enlace a las citas de un negocio o una sucursal", () => {
    const url = new URL(rutaDeCitasDe({ id: "n1", nombre: "Salón & Spa" }, { id: "s1", nombre: "Centro" }), "http://x");
    expect(url.pathname).toBe("/dashboard/admin/citas");
    expect(Object.fromEntries(url.searchParams)).toEqual({ negocio: "n1", nombre: "Salón & Spa", sucursal: "s1", nombreSucursal: "Centro" });
    expect(new URL(rutaDeCitasDe({ id: "n1", nombre: "A" }), "http://x").searchParams.has("sucursal")).toBe(false);
  });

  it("nombre visible: comercial, si no el del dueño, si no el correo", () => {
    const base = { business_name: null, first_name: null, last_name: null, email: "a@b.mx" };
    expect(nombreDeNegocio({ ...base, business_name: " Zafiro " })).toBe("Zafiro");
    expect(nombreDeNegocio({ ...base, business_name: " ", first_name: "Rita", last_name: "Rubí" })).toBe("Rita Rubí");
    expect(nombreDeNegocio(base)).toBe("a@b.mx");
  });
});

describe("pantallas de Negocios y Citas", () => {
  it("piden solo endpoints de admin y descartan respuestas viejas", () => {
    expect(negocios).toContain("api(`/api/admin/businesses");
    expect(citas).toContain("api(`/api/admin/appointments?${query}`");
    for (const fuente of [negocios, citas]) {
      expect(fuente).toContain("let vigente = true;");
      // La respuesta buena solo se guarda si sigue vigente; y al cambiar filtros, la anterior deja de serlo
      expect(fuente).toMatch(/\.then\(\(cuerpo\) => \{\s*if \(!vigente\) return;\s*setDatos\(cuerpo\);/);
      expect(fuente).toMatch(/return \(\) => \{\s*vigente = false;\s*\};/);
      expect(fuente.match(/\/api\/[a-z/-]+/g)?.every((r) => r.startsWith("/api/admin/"))).toBe(true);
    }
  });

  it("avisan los errores con toast y con un aviso visible con reintento", () => {
    for (const fuente of [negocios, citas]) {
      expect(fuente).toMatch(/showToast\(\{ type: "error"/);
      expect(fuente).toContain('role="alert"');
      expect(fuente).toContain("TEXTOS.reintentar[language]");
      expect(fuente).toContain("TEXTOS.cargando[language]");
      expect(fuente).toContain("TEXTOS.vacio[language]");
    }
  });

  it("Citas usa los helpers compartidos para fecha y estado, y no pide con un rango inválido", () => {
    expect(citas).toContain("fechaHoraCita(cita.scheduled_at, language)");
    expect(citas).toContain("etiquetaEstado(cita.status, language)");
    // Ninguna fecha formateada a mano (el monto sí usa toLocaleString de Number, para la moneda)
    expect(citas).not.toMatch(/new Date\([^)]+\)\.toLocale/);
    expect(citas).not.toMatch(/scheduled_at\)?\.toLocale/);
    expect(citas).toMatch(/if \(!query\) return;/);
    expect(citas).toContain("consultaDeCitas(");
  });

  it("Citas no muestra teléfono ni notas del cliente", () => {
    expect(citas).not.toMatch(/phone|notes|telefono|teléfono/i);
  });

  it("textos en ES/EN: sin aria-label ni placeholder fijos", () => {
    for (const fuente of [negocios, citas]) {
      expect(fuente).toContain("useLanguage()");
      expect(fuente).not.toMatch(/aria-label="[^"]+"/);
      expect(fuente).not.toMatch(/placeholder="[^"]+"/);
    }
  });

  it("el menú del admin enlaza a Negocios y Citas", () => {
    // Solo las líneas activas de navItems: un elemento comentado no cuenta
    const inicio = shell.indexOf("const navItems: NavItem[] = [");
    const menu = shell
      .slice(inicio, shell.indexOf("];", inicio))
      .split("\n")
      .filter((linea) => !linea.trim().startsWith("//"))
      .join("\n");
    expect(menu).toContain('{ href: "/dashboard/admin/negocios", label: { es: "Negocios", en: "Businesses" }, icon: Building2 }');
    expect(menu).toContain('{ href: "/dashboard/admin/citas", label: { es: "Citas", en: "Appointments" }, icon: CalendarClock }');
  });

  it('"Ver en Usuarios" llega con ?buscar= y la pestaña Usuarios arranca con esa búsqueda', () => {
    expect(negocios).toContain('`${rutaDePestana("usuarios")}&buscar=${encodeURIComponent(negocio.email)}`');
    expect(panel).toContain('const busquedaInicial = (parametros.get("buscar") ?? "").trim();');
    expect(panel).toContain("const [userQuery, setUserQuery] = useState(busquedaInicial);");
    expect(panel).toContain("const [debouncedUserQuery, setDebouncedUserQuery] = useState(busquedaInicial);");
  });
});
