import { NextResponse } from "next/server";

import { getCurrentClientUser } from "@/app/api/client/_current-user";
import { esFecha, horaLocal } from "@stylefi/shared";
import { disponibilidad, ReservaInvalida, type Sql } from "@/lib/booking";
import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";
import { esUuid } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Horarios libres de un día para un servicio: ?businessUserId&serviceId&date=AAAA-MM-DD
 * [&branchId][&stylistId]. Sin stylistId se juntan los de todos los estilistas que hacen el servicio
 * ("cualquiera"); cada horario dice qué estilistas están libres. Solo se devuelven horarios libres,
 * en la zona horaria del negocio (lib/availability.ts).
 */
export async function GET(request: Request) {
  const auth = await getCurrentClientUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { searchParams } = new URL(request.url);
  const businessUserId = searchParams.get("businessUserId")?.trim() ?? "";
  const serviceId = searchParams.get("serviceId")?.trim() ?? "";
  const date = searchParams.get("date")?.trim() ?? "";
  const branchId = searchParams.get("branchId")?.trim() || null;
  const stylistId = searchParams.get("stylistId")?.trim() || null;

  if (!businessUserId || !serviceId || !date) {
    return NextResponse.json({ error: "Se requieren businessUserId, date (AAAA-MM-DD) y serviceId." }, { status: 400 });
  }
  if (![businessUserId, serviceId, branchId, stylistId].every((id) => id === null || esUuid(id))) {
    return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
  }
  if (!esFecha(date)) {
    return NextResponse.json({ error: "Fecha inválida (AAAA-MM-DD)." }, { status: 400 });
  }

  try {
    await ensureStylehubSchema();
    const { servicio, horarios } = await disponibilidad(getDb() as unknown as Sql, {
      businessUserId,
      branchId,
      serviceId,
      stylistId,
      fecha: date,
    });

    return NextResponse.json({
      date,
      businessUserId,
      serviceDuration: servicio.duration_minutes,
      slots: horarios.map((h) => ({
        time: horaLocal(h.inicio),
        iso: h.inicio.toISOString(),
        isAvailable: true,
        stylistIds: h.estilistas,
      })),
    });
  } catch (error) {
    if (error instanceof ReservaInvalida) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error(error);
    return NextResponse.json({ error: "No se pudieron cargar los horarios disponibles." }, { status: 500 });
  }
}
