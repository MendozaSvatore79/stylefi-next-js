import { NextResponse } from "next/server";

import { getCurrentBusinessUser } from "@/app/api/business/_current-user";
import type { SqlTx } from "@/lib/booking";
import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";
import {
  DatosInvalidos,
  estilistaDelNegocio,
  reemplazarServiciosDelEstilista,
  validarServiciosDelNegocio,
} from "@/lib/stylist-config";

export const runtime = "nodejs";

/** Servicios que hace un estilista del negocio: PUT { stylistId, serviceIds } (reemplaza la lista). */
export async function PUT(request: Request) {
  const auth = await getCurrentBusinessUser();
  if ("error" in auth) {
    return auth.error;
  }
  await ensureStylehubSchema();
  const db = getDb() as unknown as SqlTx;
  const payload = (await request.json().catch(() => ({}))) as { stylistId?: unknown; serviceIds?: unknown };
  const stylistId = await estilistaDelNegocio(db, auth.userId, payload.stylistId);
  if (!stylistId) {
    return NextResponse.json({ error: "No se encontró el estilista." }, { status: 404 });
  }
  try {
    const ids = await validarServiciosDelNegocio(db, auth.userId, payload.serviceIds);
    await reemplazarServiciosDelEstilista(db, stylistId, ids);
    return NextResponse.json({ serviceIds: ids });
  } catch (error) {
    if (error instanceof DatosInvalidos) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
