import { NextResponse } from "next/server";

import { getCurrentBusinessUser } from "@/app/api/business/_current-user";
import { cancelarCita, CitaNoModificable, type SqlTx } from "@/lib/booking";
import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";
import { sendAppointmentConfirmationEmails } from "@/lib/email";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
        a.ends_at,
        a.payment_provider,
        c.first_name,
        c.last_name,
        c.email,
        st.first_name AS stylist_first_name,
        st.last_name AS stylist_last_name
      FROM stylehub_client_appointments a
      JOIN stylehub_users c ON c.id = a.client_user_id
      LEFT JOIN stylehub_business_stylists st ON st.id = a.stylist_id
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
      status?: string;
    };

    const appointmentId = payload.appointmentId?.trim();
    const status = payload.status;

    if (!appointmentId || !status) {
      return NextResponse.json({ error: "Datos de cita inválidos." }, { status: 400 });
    }

    if (!["confirmed", "completed", "cancelled", "no_show"].includes(status)) {
      return NextResponse.json({ error: "Estado de cita inválido." }, { status: 400 });
    }

    if (!UUID.test(appointmentId)) {
      return NextResponse.json({ error: "No se encontró la cita." }, { status: 404 });
    }

    // Cancelar devuelve el 100 % si se pagó con el monedero, en la misma sentencia (lib/booking.ts)
    if (status === "cancelled") {
      try {
        const { reembolso } = await cancelarCita(db as unknown as SqlTx, { appointmentId, por: "negocio", userId: auth.userId });
        return NextResponse.json({ ok: true, refund: reembolso });
      } catch (error) {
        if (error instanceof CitaNoModificable) {
          return NextResponse.json({ error: error.message }, { status: error.message.startsWith("No encontramos") ? 404 : 400 });
        }
        throw error;
      }
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
      status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
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

    // Transiciones permitidas (decisión del 2026-11-12): una cita cancelada, completada o "no asistió"
    // ya no cambia; "confirmada" solo desde "pendiente"; "completada" y "no asistió" solo después de su hora.
    // La pendiente ya ocupa su horario (no se traslapa con otra), así que confirmarla no requiere revisar.
    if (!["pending", "confirmed"].includes(previousStatus)) {
      return NextResponse.json({ error: "Esta cita ya no se puede cambiar." }, { status: 400 });
    }
    if (status === "confirmed" && previousStatus !== "pending") {
      return NextResponse.json({ error: "La cita ya está confirmada." }, { status: 400 });
    }
    if ((status === "completed" || status === "no_show") && new Date(appointment.scheduled_at).getTime() > Date.now()) {
      return NextResponse.json({ error: "Solo puedes marcarla después de la hora de la cita." }, { status: 400 });
    }

    const updated = (await db`
      UPDATE stylehub_client_appointments
      SET status = ${status},
          updated_at = NOW()
      WHERE id = ${appointmentId}
      AND business_user_id = ${auth.userId}
      AND status = ${previousStatus}
      RETURNING id
    `) as Array<{ id: string }>;

    if (updated.length === 0) {
      return NextResponse.json({ error: "La cita cambió mientras tanto; recarga e inténtalo de nuevo." }, { status: 409 });
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
