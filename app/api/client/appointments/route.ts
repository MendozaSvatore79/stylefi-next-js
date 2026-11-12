import { NextResponse } from "next/server";

import { getCurrentClientUser } from "@/app/api/client/_current-user";
import {
  cancelarCita,
  CitaNoModificable,
  HorarioNoDisponible,
  reagendarCita,
  ReservaInvalida,
  reservar,
  SaldoInsuficiente,
  type SqlTx,
} from "@/lib/booking";
import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


export async function GET() {
  const auth = await getCurrentClientUser();
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
        a.ends_at,
        a.status,
        a.total_amount,
        a.payment_provider,
        a.notes,
        a.created_at,
        a.stylist_id,
        st.first_name AS stylist_first_name,
        st.last_name AS stylist_last_name,
        b.business_name,
        b.first_name,
        b.last_name
      FROM stylehub_client_appointments a
      JOIN stylehub_users b ON b.id = a.business_user_id
      LEFT JOIN stylehub_business_stylists st ON st.id = a.stylist_id
      WHERE a.client_user_id = ${auth.userId}
      ORDER BY a.scheduled_at DESC
    `;

    return NextResponse.json({ appointments });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudieron cargar las citas." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await getCurrentClientUser();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    await ensureStylehubSchema();
    const db = getDb();
    // El precio, el nombre del servicio y la hora de fin NO se aceptan del navegador: salen del servicio.
    const payload = (await request.json()) as {
      businessUserId?: string;
      branchId?: string | null;
      serviceId?: string | null;
      stylistId?: string | null;
      scheduledAt?: string;
      paymentProvider?: string;
      notes?: string;
    };

    const businessUserId = payload.businessUserId?.trim() || null;
    const branchId = payload.branchId?.trim() || null;
    const serviceId = payload.serviceId?.trim() || null;
    const stylistId = payload.stylistId?.trim() || null;
    const inicio = payload.scheduledAt ? new Date(payload.scheduledAt) : null;
    const notas = payload.notes?.trim() || null;

    if (!businessUserId || !serviceId || !inicio || Number.isNaN(inicio.getTime())) {
      return NextResponse.json({ error: "Completa negocio, servicio y fecha/hora." }, { status: 400 });
    }
    if (![businessUserId, serviceId, branchId, stylistId].every((id) => id === null || UUID.test(id))) {
      return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
    }
    // La opción "tarjeta" se quitó: solo guardaba la tarjeta elegida, nunca cobraba (decisión del 2026-11-12)
    if (payload.paymentProvider === "card") {
      return NextResponse.json({ error: "Por ahora las citas se pagan en efectivo en el salón o con tu wallet." }, { status: 400 });
    }

    const [negocio] = (await db`
      SELECT id FROM stylehub_users WHERE id = ${businessUserId} AND account_type = 'negocio' LIMIT 1
    `) as Array<{ id: string }>;
    if (!negocio) {
      return NextResponse.json({ error: "El negocio seleccionado no es válido." }, { status: 400 });
    }

    const appointment = await reservar(db as unknown as SqlTx, {
      clienteId: auth.userId,
      businessUserId,
      branchId,
      serviceId,
      stylistId,
      inicio,
      pago: payload.paymentProvider === "wallet" ? "wallet" : "cash",
      notas,
    });

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (error) {
    if (error instanceof ReservaInvalida || error instanceof SaldoInsuficiente) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof HorarioNoDisponible) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ error: "No se pudo agendar la cita." }, { status: 500 });
  }
}

/** Cancelar ({ status: "cancelled" }) o reagendar ({ scheduledAt, stylistId? }), hasta 2 horas antes. */
export async function PATCH(request: Request) {
  const auth = await getCurrentClientUser();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    await ensureStylehubSchema();
    const db = getDb() as unknown as SqlTx;

    const payload = (await request.json()) as {
      appointmentId?: string;
      scheduledAt?: string;
      stylistId?: string | null;
      notes?: string;
      status?: string;
    };

    const appointmentId = payload.appointmentId?.trim() ?? "";
    const stylistId = payload.stylistId?.trim() || null;
    if (!UUID.test(appointmentId) || (stylistId && !UUID.test(stylistId))) {
      return NextResponse.json({ error: "Debes indicar la cita." }, { status: 400 });
    }

    if (payload.status?.trim().toLowerCase() === "cancelled") {
      const { reembolso } = await cancelarCita(db, { appointmentId, por: "cliente", userId: auth.userId });
      return NextResponse.json({ ok: true, mode: "cancelled", refund: reembolso });
    }

    const nuevoInicio = payload.scheduledAt ? new Date(payload.scheduledAt) : null;
    if (!nuevoInicio || Number.isNaN(nuevoInicio.getTime())) {
      return NextResponse.json({ error: "Debes indicar una nueva fecha válida." }, { status: 400 });
    }

    const cita = await reagendarCita(db, { appointmentId, clienteId: auth.userId, nuevoInicio, stylistId });

    if (typeof payload.notes === "string") {
      await db`
        UPDATE stylehub_client_appointments
        SET notes = ${payload.notes.trim() || null}, updated_at = NOW()
        WHERE id = ${appointmentId} AND client_user_id = ${auth.userId}
      `;
    }

    return NextResponse.json({ ok: true, mode: "rescheduled", appointment: cita });
  } catch (error) {
    if (error instanceof CitaNoModificable || error instanceof ReservaInvalida) {
      return NextResponse.json({ error: error.message }, { status: error.message.startsWith("No encontramos") ? 404 : 400 });
    }
    if (error instanceof HorarioNoDisponible) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ error: "No se pudo actualizar la cita." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await getCurrentClientUser();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    await ensureStylehubSchema();
    const db = getDb();
    const payload = (await request.json()) as {
      appointmentId?: string;
      clearHistory?: boolean;
      clearMode?: "past" | "all";
    };

    const appointmentId = payload.appointmentId?.trim();
    const clearHistory = Boolean(payload.clearHistory);
    const clearMode = payload.clearMode;

    if (clearHistory || clearMode === "past" || clearMode === "all") {
      const shouldClearAll = clearHistory || clearMode === "all";

      const deleted = (await db`
        DELETE FROM stylehub_client_appointments
        WHERE client_user_id = ${auth.userId}
          AND (
            ${shouldClearAll}
            OR status IN ('completed', 'cancelled')
            OR scheduled_at < NOW()
          )
        RETURNING id
      `) as Array<{ id: string }>;

      return NextResponse.json({ ok: true, deletedCount: deleted.length });
    }

    if (!appointmentId) {
      return NextResponse.json({ error: "Debes indicar la cita a borrar." }, { status: 400 });
    }

    const deleted = (await db`
      DELETE FROM stylehub_client_appointments
      WHERE id = ${appointmentId}
        AND client_user_id = ${auth.userId}
        AND (status IN ('completed', 'cancelled') OR scheduled_at < NOW())
      RETURNING id
    `) as Array<{ id: string }>;

    if (!deleted[0]) {
      return NextResponse.json(
        { error: "Solo puedes borrar citas del historial (pasadas, completadas o canceladas)." },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo borrar la cita." }, { status: 500 });
  }
}
