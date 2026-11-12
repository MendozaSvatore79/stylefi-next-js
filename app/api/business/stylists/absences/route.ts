import { NextResponse } from "next/server";

import { getCurrentBusinessUser } from "@/app/api/business/_current-user";
import type { SqlTx } from "@/lib/booking";
import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";
import { DatosInvalidos, estilistaDelNegocio, validarAusencia } from "@/lib/stylist-config";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ausencias vigentes de un estilista del negocio. GET ?stylistId, POST { stylistId, startsAt, endsAt, reason }, DELETE { id }. */
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
  const absences = await db`
    SELECT id, starts_at, ends_at, reason FROM stylehub_stylist_absences
    WHERE stylist_id = ${stylistId} AND ends_at >= NOW()
    ORDER BY starts_at
  `;
  return NextResponse.json({ absences });
}

export async function POST(request: Request) {
  const auth = await getCurrentBusinessUser();
  if ("error" in auth) {
    return auth.error;
  }
  await ensureStylehubSchema();
  const db = getDb() as unknown as SqlTx;
  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const stylistId = await estilistaDelNegocio(db, auth.userId, payload.stylistId);
  if (!stylistId) {
    return NextResponse.json({ error: "No se encontró el estilista." }, { status: 404 });
  }
  try {
    const { inicio, fin, motivo } = validarAusencia(payload);
    const [absence] = await db`
      INSERT INTO stylehub_stylist_absences (stylist_id, starts_at, ends_at, reason)
      VALUES (${stylistId}, ${inicio.toISOString()}, ${fin.toISOString()}, ${motivo})
      RETURNING id, starts_at, ends_at, reason
    `;
    return NextResponse.json({ absence }, { status: 201 });
  } catch (error) {
    if (error instanceof DatosInvalidos) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

export async function DELETE(request: Request) {
  const auth = await getCurrentBusinessUser();
  if ("error" in auth) {
    return auth.error;
  }
  await ensureStylehubSchema();
  const db = getDb() as unknown as SqlTx;
  const { id } = (await request.json().catch(() => ({}))) as { id?: unknown };
  if (typeof id !== "string" || !UUID.test(id)) {
    return NextResponse.json({ error: "No se encontró la ausencia." }, { status: 404 });
  }
  const borradas = await db`
    DELETE FROM stylehub_stylist_absences a
    USING stylehub_business_stylists s
    WHERE a.id = ${id} AND s.id = a.stylist_id AND s.business_user_id = ${auth.userId}
    RETURNING a.id
  `;
  if (borradas.length === 0) {
    return NextResponse.json({ error: "No se encontró la ausencia." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
