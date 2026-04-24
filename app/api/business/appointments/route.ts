import { NextResponse } from "next/server";

import { getCurrentBusinessUser } from "@/app/api/business/_current-user";
import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";
import { sendAppointmentConfirmationEmails } from "@/lib/email";

export const runtime = "nodejs";

export async function GET() {
  const auth = await getCurrentBusinessUser();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    await ensureStylehubSchema();
    const db = getDb();

    const appointments = await db`
      SELECT
        a.id,
        a.service_name,
        a.scheduled_at,
        a.status,
        a.total_amount,
        a.notes,
        a.created_at,
        c.first_name,
        c.last_name,
        c.email
      FROM stylehub_client_appointments a
      JOIN stylehub_users c ON c.id = a.client_user_id
      WHERE a.business_user_id = ${auth.userId}
      ORDER BY a.scheduled_at ASC
    `;

    return NextResponse.json({ appointments });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudieron cargar las citas." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await getCurrentBusinessUser();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    await ensureStylehubSchema();
    const db = getDb();
    const payload = (await request.json()) as {
      appointmentId?: string;
      status?: "pending" | "confirmed" | "completed" | "cancelled";
    };

    const appointmentId = payload.appointmentId?.trim();
    const status = payload.status;

    if (!appointmentId || !status) {
      return NextResponse.json({ error: "Datos de cita inválidos." }, { status: 400 });
    }

    if (!["pending", "confirmed", "completed", "cancelled"].includes(status)) {
      return NextResponse.json({ error: "Estado de cita inválido." }, { status: 400 });
    }

    const appointments = (await db`
      SELECT
        a.id,
        a.status,
        a.service_name,
        a.scheduled_at,
        a.total_amount,
        c.first_name AS client_first_name,
        c.last_name AS client_last_name,
        c.email AS client_email,
        b.business_name,
        b.first_name AS business_first_name,
        b.last_name AS business_last_name,
        b.email AS business_email
      FROM stylehub_client_appointments a
      JOIN stylehub_users c ON c.id = a.client_user_id
      JOIN stylehub_users b ON b.id = a.business_user_id
      WHERE a.id = ${appointmentId}
      AND a.business_user_id = ${auth.userId}
      LIMIT 1
    `) as Array<{
      id: string;
      status: "pending" | "confirmed" | "completed" | "cancelled";
      service_name: string;
      scheduled_at: string;
      total_amount: string;
      client_first_name: string | null;
      client_last_name: string | null;
      client_email: string;
      business_name: string | null;
      business_first_name: string | null;
      business_last_name: string | null;
      business_email: string;
    }>;

    if (appointments.length === 0) {
      return NextResponse.json({ error: "No se encontró la cita." }, { status: 404 });
    }

    const appointment = appointments[0];
    const previousStatus = appointment.status;

    // Validar transiciones de status permitidas y disponibilidad
    if (status === "confirmed" && previousStatus === "pending") {
      // Al confirmar, validar que no haya conflicto con otro horario
      const conflicting = (await db`
        SELECT id
        FROM stylehub_client_appointments
        WHERE business_user_id = ${auth.userId}
        AND id != ${appointmentId}
        AND status IN ('pending', 'confirmed')
        AND scheduled_at = ${appointment.scheduled_at}
        LIMIT 1
      `) as Array<{ id: string }>;

      if (conflicting.length > 0) {
        return NextResponse.json(
          { error: "Ese horario ya está ocupado. No se puede confirmar la cita." },
          { status: 409 },
        );
      }
    }

    const updated = (await db`
      UPDATE stylehub_client_appointments
      SET status = ${status},
          updated_at = NOW()
      WHERE id = ${appointmentId}
      AND business_user_id = ${auth.userId}
      RETURNING id
    `) as Array<{ id: string }>;

    if (updated.length === 0) {
      return NextResponse.json({ error: "No se encontró la cita." }, { status: 404 });
    }

    if (status === "confirmed" && previousStatus !== "confirmed") {
      const clientName =
        `${appointment.client_first_name ?? ""} ${appointment.client_last_name ?? ""}`.trim() || "Cliente";
      const businessName =
        appointment.business_name ||
        `${appointment.business_first_name ?? ""} ${appointment.business_last_name ?? ""}`.trim() ||
        "Negocio";

      void sendAppointmentConfirmationEmails({
        businessEmail: appointment.business_email,
        businessName,
        clientEmail: appointment.client_email,
        clientName,
        serviceName: appointment.service_name,
        scheduledAt: appointment.scheduled_at,
        totalAmount: Number(appointment.total_amount),
      }).catch((emailError) => {
        console.error("No se pudo enviar el correo de confirmación:", emailError);
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo actualizar la cita." }, { status: 500 });
  }
}
