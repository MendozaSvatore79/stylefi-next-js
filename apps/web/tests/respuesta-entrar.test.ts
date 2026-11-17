import { describe, expect, it } from "vitest";

import { interpretarRespuestaEntrar } from "@/lib/respuesta-entrar";

describe("interpretarRespuestaEntrar", () => {
  it("un 429 se convierte en espera, no en redirección al login", async () => {
    const resultado = await interpretarRespuestaEntrar(
      new Response("{}", { status: 429, headers: { "Retry-After": "17" } }),
    );

    expect(resultado).toEqual({ tipo: "espera", segundos: 17 });
  });

  it("usa una espera acotada si Retry-After no está disponible", async () => {
    const resultado = await interpretarRespuestaEntrar(new Response("{}", { status: 429 }));

    expect(resultado).toEqual({ tipo: "espera", segundos: 60 });
  });

  it("no manda errores temporales del backend al login", async () => {
    expect(await interpretarRespuestaEntrar(new Response("{}", { status: 503 }))).toEqual({ tipo: "error" });
  });

  it("mantiene la redirección de sesión vencida y los destinos válidos", async () => {
    expect(await interpretarRespuestaEntrar(new Response("{}", { status: 401 }))).toEqual({
      tipo: "destino",
      destino: "/iniciar-sesion",
    });
    expect(
      await interpretarRespuestaEntrar(Response.json({ destino: "/dashboard/cliente" })),
    ).toEqual({ tipo: "destino", destino: "/dashboard/cliente" });
  });
});
