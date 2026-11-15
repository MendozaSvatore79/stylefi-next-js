/** NEXT_PUBLIC_API_URL sin http(s):// rompía /entrar en producción (bucle con /iniciar-sesion): el build debe fallar. */
import { describe, expect, it } from "vitest";

import { errorEnUrlDelBackend } from "@/lib/url-backend";

describe("errorEnUrlDelBackend", () => {
  it("vacía o sin definir: falta la variable", () => {
    for (const v of [undefined, "", "   "]) expect(errorEnUrlDelBackend(v)).toMatch(/^Falta NEXT_PUBLIC_API_URL/);
  });

  it("sin http:// ni https:// (el caso de producción): error con la URL corregida de ejemplo", () => {
    const error = errorEnUrlDelBackend("api.stylehub.synovasystems.com");
    expect(error).toMatch(/debe empezar con http:\/\/ o https:\/\//);
    expect(error).toContain("https://api.stylehub.synovasystems.com");
  });

  it("otros esquemas o URLs mal formadas: error", () => {
    for (const v of ["ftp://api.x.com", "//api.x.com", "https://", "https:api.x.com", "http//api.x.com"]) {
      expect(errorEnUrlDelBackend(v), v).not.toBeNull();
    }
  });

  it("http:// o https:// con host: válida (con espacios, mayúsculas, puerto o barra final)", () => {
    for (const v of [
      "https://api.stylehub.synovasystems.com",
      " https://api.stylehub.synovasystems.com/ ",
      "HTTPS://api.x.com",
      "http://localhost:4000",
    ]) {
      expect(errorEnUrlDelBackend(v), v).toBeNull();
    }
  });
});
