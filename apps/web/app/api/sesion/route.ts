import { NextResponse } from "next/server";

import { obtenerSesion } from "@/lib/sesion";

export const runtime = "nodejs";

/** Sesión de la app para las pantallas del navegador (useSesion). null si no hay sesión o cuenta. */
export async function GET() {
  const sesion = await obtenerSesion();
  return NextResponse.json(sesion ?? { user: null }, { headers: { "Cache-Control": "no-store" } });
}
