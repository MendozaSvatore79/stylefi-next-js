import { NextResponse } from "next/server";

import { estadoDeRegistro, inicioPorTipo } from "@/lib/sesion";

export const runtime = "nodejs";

/** A dónde va alguien justo después de entrar o registrarse en Clerk. */
export async function GET() {
  const estado = await estadoDeRegistro();
  const destino =
    estado.estado === "sin-sesion"
      ? "/iniciar-sesion"
      : estado.estado === "baneada"
        ? "/cuenta-suspendida"
        : estado.estado === "sin-registro"
          ? "/registro/completar"
          : inicioPorTipo(estado.accountType);
  return NextResponse.json({ destino }, { headers: { "Cache-Control": "no-store" } });
}
