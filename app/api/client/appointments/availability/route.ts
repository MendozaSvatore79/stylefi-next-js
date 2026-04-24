import { NextResponse } from "next/server";

import { getCurrentClientUser } from "@/app/api/client/_current-user";
import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await getCurrentClientUser();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    await ensureStylehubSchema();
    const db = getDb();

    const { searchParams } = new URL(request.url);
    const businessUserId = searchParams.get("businessUserId")?.trim();
    const date = searchParams.get("date")?.trim(); // YYYY-MM-DD
    const serviceId = searchParams.get("serviceId")?.trim();

    if (!businessUserId || !date || !serviceId) {
      return NextResponse.json(
        { error: "Se requieren businessUserId, date (YYYY-MM-DD) y serviceId." },
        { status: 400 },
      );
    }

    // Validar que sea una fecha válida
    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "Fecha inválida (YYYY-MM-DD)." }, { status: 400 });
    }

    // Obtener duración del servicio
    const services = (await db`
      SELECT duration_minutes
      FROM stylehub_business_services
      WHERE id = ${serviceId}
      AND business_user_id = ${businessUserId}
      LIMIT 1
    `) as Array<{ duration_minutes: number | null }>;

    if (services.length === 0) {
      return NextResponse.json({ error: "Servicio no encontrado." }, { status: 404 });
    }

    const serviceDurationMinutes = services[0].duration_minutes ?? 30; // Por defecto 30 minutos

    // Obtener las horas de operación del negocio
    const businessInfo = (await db`
      SELECT opening_hours, closing_hours
      FROM stylehub_business_info
      WHERE business_user_id = ${businessUserId}
      LIMIT 1
    `) as Array<{ opening_hours: string | null; closing_hours: string | null }>;

    if (businessInfo.length === 0 || !businessInfo[0].opening_hours || !businessInfo[0].closing_hours) {
      // Usar horarios por defecto si no están configurados
      const defaultOpeningHours = "09:00";
      const defaultClosingHours = "18:00";

      const slots: Array<{
        time: string;
        isAvailable: boolean;
        iso: string;
      }> = [];

      const [openHour, openMin] = defaultOpeningHours.split(":").map(Number);
      const [closeHour, closeMin] = defaultClosingHours.split(":").map(Number);

      let currentMinutes = openHour * 60 + openMin;
      const closeMinutes = closeHour * 60 + closeMin;

      while (currentMinutes < closeMinutes) {
        const hour = Math.floor(currentMinutes / 60);
        const min = currentMinutes % 60;
        const timeStr = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
        const fullDate = new Date(`${date}T${timeStr}:00`);

        // Check if slot is occupied
        const occupied = (await db`
          SELECT id
          FROM stylehub_client_appointments
          WHERE business_user_id = ${businessUserId}
          AND status IN ('pending', 'confirmed')
          AND scheduled_at = ${fullDate.toISOString()}
          LIMIT 1
        `) as Array<{ id: string }>;

        slots.push({
          time: timeStr,
          isAvailable: occupied.length === 0,
          iso: fullDate.toISOString(),
        });

        currentMinutes += serviceDurationMinutes;
      }

      return NextResponse.json({ slots, date, businessUserId });
    }

    const openingHours = businessInfo[0].opening_hours; // HH:mm
    const closingHours = businessInfo[0].closing_hours; // HH:mm

    // Parsear horarios
    const [openHour, openMin] = openingHours.split(":").map(Number);
    const [closeHour, closeMin] = closingHours.split(":").map(Number);

    // Generar slots según duración del servicio
    const slots: Array<{
      time: string;
      isAvailable: boolean;
      iso: string;
    }> = [];

    let currentMinutes = openHour * 60 + openMin;
    const closeMinutes = closeHour * 60 + closeMin;

    while (currentMinutes < closeMinutes) {
      const hour = Math.floor(currentMinutes / 60);
      const min = currentMinutes % 60;
      const timeStr = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
      const fullDate = new Date(`${date}T${timeStr}:00`);

      // Check if slot is occupied
      const occupied = (await db`
        SELECT id
        FROM stylehub_client_appointments
        WHERE business_user_id = ${businessUserId}
        AND status IN ('pending', 'confirmed')
        AND scheduled_at = ${fullDate.toISOString()}
        LIMIT 1
      `) as Array<{ id: string }>;

      slots.push({
        time: timeStr,
        isAvailable: occupied.length === 0,
        iso: fullDate.toISOString(),
      });

      // Incrementar según duración del servicio
      currentMinutes += serviceDurationMinutes;
    }

    return NextResponse.json({ slots, date, businessUserId, serviceDuration: serviceDurationMinutes });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudieron cargar los horarios disponibles." }, { status: 500 });
  }
}
