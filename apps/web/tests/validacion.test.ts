/** Validación de formularios y ruta activa del menú (escritas sin correr, regla de ahorro de Eric). */
import { describe, expect, it } from "vitest";

import { rutaActiva } from "@/lib/ruta-activa";
import {
  errorCodigoPostal,
  errorCorreo,
  errorRango,
  errorTelefono,
  errorTexto,
  errorUrl,
  limpiarCodigoPostal,
  limpiarTelefono,
  primerError,
} from "@/lib/validacion";

const campo = { es: "El nombre", en: "The name" };

describe("teléfono y código postal", () => {
  it("limpia al escribir: solo dígitos, quita la lada 52 al pegar 12 dígitos y nunca pasa de 10", () => {
    expect(limpiarTelefono("55 1234-5678")).toBe("5512345678");
    expect(limpiarTelefono("+52 55 1234 5678")).toBe("5512345678");
    expect(limpiarTelefono("551234567890")).toBe("5512345678");
    expect(limpiarTelefono("abc")).toBe("");
    expect(limpiarCodigoPostal("06 600-1")).toBe("06600");
  });

  it("10 dígitos; vacío solo si es opcional", () => {
    expect(errorTelefono("5512345678", "es")).toBeNull();
    expect(errorTelefono("551234567", "es")).toBe("El teléfono debe tener 10 dígitos.");
    expect(errorTelefono("", "es")).toBeNull();
    expect(errorTelefono("", "es", { obligatorio: true })).toBe("El teléfono es obligatorio.");
    expect(errorCodigoPostal("06600", "es")).toBeNull();
    expect(errorCodigoPostal("", "es")).toBeNull();
    expect(errorCodigoPostal("6600", "es")).toBe("El código postal debe tener 5 dígitos.");
  });
});

describe("textos, URL, correo y números", () => {
  it("texto: obligatorio, solo espacios, largo y caracteres de control", () => {
    expect(errorTexto("  ", campo, 60, "es", { obligatorio: true })).toBe("El nombre es obligatorio.");
    expect(errorTexto("x".repeat(61), campo, 60, "es")).toBe("El nombre admite máximo 60 caracteres.");
    expect(errorTexto("a\u0000b", campo, 60, "es")).toBe("El nombre tiene caracteres no permitidos.");
    expect(errorTexto("a\nb", campo, 500, "es", { multilinea: true })).toBeNull();
    expect(errorTexto("Ana", campo, 60, "en")).toBeNull();
  });

  it("URL, correo y rangos", () => {
    expect(errorUrl("salon.mx", { es: "El sitio web", en: "The website" }, "es")).toBe("El sitio web debe empezar con http:// o https://");
    expect(errorUrl("http://a.mx/i.png", { es: "La imagen", en: "The image" }, "es", { soloHttps: true })).toBe("La imagen debe empezar con https://");
    expect(errorCorreo("ana@salon", "es")).toBe("El correo no es válido.");
    expect(errorCorreo("", "es")).toBeNull();
    expect(errorRango("0", { es: "El precio", en: "The price" }, 0, 100000, "es", { minimoExclusivo: true })).toBe("El precio debe ser mayor a 0 y de máximo 100000.");
    expect(errorRango("481", { es: "La duración", en: "The duration" }, 5, 480, "es", { entero: true })).toBe("La duración debe estar entre 5 y 480.");
    expect(errorRango("2.5", { es: "Los años", en: "Years" }, 0, 60, "es", { entero: true })).toBe("Los años no es un número válido.");
    expect(errorRango("", { es: "La duración", en: "The duration" }, 5, 480, "es")).toBeNull();
    expect(primerError(null, "uno", "dos")).toBe("uno");
  });
});

describe("ruta activa del menú", () => {
  it("la raíz solo con la ruta exacta; las demás con su ruta o sus subrutas", () => {
    expect(rutaActiva("/dashboard/negocio", "/dashboard/negocio", "/dashboard/negocio")).toBe(true);
    expect(rutaActiva("/dashboard/negocio/estilistas", "/dashboard/negocio", "/dashboard/negocio")).toBe(false);
    expect(rutaActiva("/dashboard/negocio/estilistas", "/dashboard/negocio/estilistas", "/dashboard/negocio")).toBe(true);
    expect(rutaActiva("/dashboard/admin/soporte/1", "/dashboard/admin/soporte", "/dashboard/admin")).toBe(true);
    expect(rutaActiva("/dashboard/admin/soporte-x", "/dashboard/admin/soporte", "/dashboard/admin")).toBe(false);
  });
});
