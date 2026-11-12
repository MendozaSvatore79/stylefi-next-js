import { NextResponse } from "next/server";

import { getCurrentBusinessUser } from "@/app/api/business/_current-user";
import type { SqlTx } from "@/lib/booking";
import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";
import { DatosInvalidos, estilistaDelNegocio, guardarHorario, leerHorario, validarBloques } from "@/lib/stylist-config";

export const runtime = "nodejs";

/** Horario semanal de un estilista del negocio: GET ?stylistId, PUT { stylistId, blocks } (reemplaza todo). */
export async function GET(request: Request) {
  const auth = await getCurrentBusinessUser();
  if ("error" in auth) {
    return auth.error;
  }
  await ensureStylehubSchema();
  const db = getDb() as unknown as SqlTx;
  const stylistId = await estilistaDelNegocio(db, auth.userId, new URL(request.url).searchParams.get("stylistId"));
  if (!stylistId) {
    return NextResponse.json({ error: "No se encontró el estilista." }, { status: 404 });
  }
  return NextResponse.json({ blocks: await leerHorario(db, stylistId) });
}

export async function PUT(request: Request) {
  const auth = await getCurrentBusinessUser();
  if ("error" in auth) {
    return auth.error;
  }
  await ensureStylehubSchema();
  const db = getDb() as unknown as SqlTx;
  const payload = (await request.json().catch(() => ({}))) as { stylistId?: unknown; blocks?: unknown };
  const stylistId = await estilistaDelNegocio(db, auth.userId, payload.stylistId);
  if (!stylistId) {
    return NextResponse.json({ error: "No se encontró el estilista." }, { status: 404 });
  }
  try {
    await guardarHorario(db, stylistId, validarBloques(payload.blocks));
  } catch (error) {
    if (error instanceof DatosInvalidos) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
  return NextResponse.json({ blocks: await leerHorario(db, stylistId) });
}
