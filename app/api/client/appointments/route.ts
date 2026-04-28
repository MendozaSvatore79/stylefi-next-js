import { NextResponse } from "next/server";

import { getCurrentClientUser } from "@/app/api/client/_current-user";
import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";

export const runtime = "nodejs";

function mxDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

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
        a.status,
        a.total_amount,
        a.notes,
        a.created_at,
        b.business_name,
        b.first_name,
        b.last_name
      FROM stylehub_client_appointments a
      JOIN stylehub_users b ON b.id = a.business_user_id
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
    const payload = (await request.json()) as {
      businessUserId?: string;
      branchId?: string | null;
      serviceId?: string | null;
      serviceName?: string;
      scheduledAt?: string;
      totalAmount?: number;
      paymentMethodId?: string | null;
      paymentProvider?: "cash" | "wallet" | "card";
      notes?: string;
    };

    const businessUserId = payload.businessUserId?.trim();
    const branchId = payload.branchId?.trim() || null;
    const serviceId = payload.serviceId?.trim() || null;
    const serviceName = payload.serviceName?.trim();
    const scheduledAt = payload.scheduledAt ? new Date(payload.scheduledAt) : null;
    const totalAmount = Number(payload.totalAmount ?? 0);
    const paymentMethodId = payload.paymentMethodId?.trim() || null;
    const paymentProvider = payload.paymentProvider === "wallet" || payload.paymentProvider === "card" ? payload.paymentProvider : "cash";
    const notes = payload.notes?.trim() || null;

    if (!businessUserId || !serviceName || !scheduledAt || Number.isNaN(scheduledAt.getTime())) {
      return NextResponse.json({ error: "Completa negocio, servicio y fecha/hora." }, { status: 400 });
    }

    if (scheduledAt.getTime() < Date.now()) {
      return NextResponse.json({ error: "La cita debe ser en una fecha futura." }, { status: 400 });
    }

    if (totalAmount <= 0) {
      return NextResponse.json({ error: "Ingresa un monto válido para la cita." }, { status: 400 });
    }

    const businesses = (await db`
      SELECT id
      FROM stylehub_users
      WHERE id = ${businessUserId}
      AND account_type = 'negocio'
      LIMIT 1
    `) as Array<{ id: string }>;

    if (businesses.length === 0) {
      return NextResponse.json({ error: "El negocio seleccionado no es válido." }, { status: 400 });
    }

    if (branchId) {
      const branch = (await db`
        SELECT id
        FROM stylehub_business_branches
        WHERE id = ${branchId}
          AND business_user_id = ${businessUserId}
          AND validation_status = 'approved'
        LIMIT 1
      `) as Array<{ id: string }>;

      if (branch.length === 0) {
        return NextResponse.json({ error: "La sucursal seleccionada no es válida para este negocio." }, { status: 400 });
      }
    }

    if (serviceId) {
      const service = branchId
        ? ((await db`
            SELECT id
            FROM stylehub_business_services
            WHERE id = ${serviceId}
              AND business_user_id = ${businessUserId}
              AND branch_id = ${branchId}
            LIMIT 1
          `) as Array<{ id: string }>)
        : ((await db`
            SELECT id
            FROM stylehub_business_services
            WHERE id = ${serviceId}
              AND business_user_id = ${businessUserId}
            LIMIT 1
          `) as Array<{ id: string }>);

      if (service.length === 0) {
        return NextResponse.json({ error: "El servicio seleccionado no pertenece a la sucursal elegida." }, { status: 400 });
      }
    }

    // Validar que no exista cita en el mismo horario del negocio
    const conflictingAppointments = (await db`
      SELECT id
      FROM stylehub_client_appointments
      WHERE business_user_id = ${businessUserId}
      AND status IN ('pending', 'confirmed')
      AND scheduled_at = ${scheduledAt.toISOString()}
      LIMIT 1
    `) as Array<{ id: string }>;

    if (conflictingAppointments.length > 0) {
      return NextResponse.json(
        { error: "Este horario ya está ocupado. Por favor selecciona otro." },
        { status: 409 },
      );
    }

    if (paymentProvider === "card" && !paymentMethodId) {
      return NextResponse.json({ error: "Selecciona una tarjeta guardada para continuar." }, { status: 400 });
    }

    if (paymentMethodId) {
      const methods = (await db`
        SELECT id, provider
        FROM stylehub_client_payment_methods
        WHERE id = ${paymentMethodId}
        AND user_id = ${auth.userId}
        LIMIT 1
      `) as Array<{ id: string; provider: string }>;

      if (methods.length === 0) {
        return NextResponse.json({ error: "El método de pago seleccionado no te pertenece." }, { status: 400 });
      }

      if (paymentProvider === "card" && methods[0].provider !== "card") {
        return NextResponse.json({ error: "Debes seleccionar una tarjeta guardada válida." }, { status: 400 });
      }

      if (paymentProvider !== "card") {
        return NextResponse.json({ error: "Las citas del salón solo aceptan efectivo, wallet o tarjeta guardada." }, { status: 400 });
      }
    }

    if (paymentProvider === "wallet") {
      const [wallet] = (await db`
        SELECT id, balance
        FROM stylehub_client_wallets
        WHERE user_id = ${auth.userId}
        LIMIT 1
      `) as Array<{ id: string; balance: string }>;

      if (!wallet) {
        return NextResponse.json({ error: "No tienes wallet configurada para pagar con saldo." }, { status: 400 });
      }

      const updatedWallets = (await db`
        UPDATE stylehub_client_wallets
        SET balance = balance - ${totalAmount},
            updated_at = NOW()
        WHERE id = ${wallet.id}
          AND balance >= ${totalAmount}
        RETURNING id
      `) as Array<{ id: string }>;

      if (updatedWallets.length === 0) {
        return NextResponse.json({ error: "Saldo insuficiente para pagar esta cita." }, { status: 400 });
      }

      await db`
        INSERT INTO stylehub_client_wallet_transactions (
          wallet_id,
          user_id,
          transaction_type,
          amount,
          payment_provider,
          status,
          notes
        )
        VALUES (
          ${wallet.id},
          ${auth.userId},
          'debit',
          ${totalAmount},
          'wallet',
          'completed',
          ${`Pago de cita: ${serviceName}`}
        )
      `;
    }

    const [appointment] = (await db`
      INSERT INTO stylehub_client_appointments (
        client_user_id,
        business_user_id,
        branch_id,
        service_id,
        service_name,
        scheduled_at,
        total_amount,
        payment_method_id,
        payment_provider,
        notes,
        status,
        updated_at
      )
      VALUES (
        ${auth.userId},
        ${businessUserId},
        ${branchId},
        ${serviceId},
        ${serviceName},
        ${scheduledAt.toISOString()},
        ${totalAmount},
        ${paymentMethodId},
        ${paymentProvider},
        ${notes},
        'confirmed',
        NOW()
      )
      RETURNING id, service_name, scheduled_at, status, total_amount, notes, created_at
    `) as Array<{
      id: string;
      service_name: string;
      scheduled_at: string;
      status: string;
      total_amount: string;
      notes: string | null;
      created_at: string;
    }>;

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo agendar la cita." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await getCurrentClientUser();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    await ensureStylehubSchema();
    const db = getDb();

    const payload = (await request.json()) as {
      appointmentId?: string;
      scheduledAt?: string;
      notes?: string;
      status?: string;
    };

    const appointmentId = payload.appointmentId?.trim();
    const requestedStatus = payload.status?.trim().toLowerCase();
    const nextScheduledAt = payload.scheduledAt ? new Date(payload.scheduledAt) : null;
    const notes = payload.notes?.trim() || null;

    if (!appointmentId) {
      return NextResponse.json({ error: "Debes indicar la cita." }, { status: 400 });
    }

    const currentAppointments = (await db`
      SELECT id, scheduled_at, status
      FROM stylehub_client_appointments
      WHERE id = ${appointmentId}
        AND client_user_id = ${auth.userId}
      LIMIT 1
    `) as Array<{
      id: string;
      scheduled_at: string;
      status: "pending" | "confirmed" | "completed" | "cancelled";
    }>;

    if (!currentAppointments[0]) {
      return NextResponse.json({ error: "No encontramos esa cita en tu cuenta." }, { status: 404 });
    }

    const currentAppointment = currentAppointments[0];

    if (requestedStatus === "cancelled") {
      if (!["pending", "confirmed"].includes(currentAppointment.status)) {
        return NextResponse.json({ error: "Solo puedes cancelar citas pendientes o confirmadas." }, { status: 400 });
      }

      await db`
        UPDATE stylehub_client_appointments
        SET status = 'cancelled',
            updated_at = NOW()
        WHERE id = ${appointmentId}
          AND client_user_id = ${auth.userId}
      `;

      return NextResponse.json({ ok: true, mode: "cancelled" });
    }

    if (!nextScheduledAt || Number.isNaN(nextScheduledAt.getTime())) {
      return NextResponse.json({ error: "Debes indicar una nueva fecha válida." }, { status: 400 });
    }

    if (nextScheduledAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: "La nueva fecha debe ser futura." }, { status: 400 });
    }

    if (!["pending", "confirmed"].includes(currentAppointment.status)) {
      return NextResponse.json({ error: "Solo puedes reagendar citas pendientes o confirmadas." }, { status: 400 });
    }

    const scheduledDate = new Date(currentAppointment.scheduled_at);
    if (mxDateKey(scheduledDate) === mxDateKey(new Date())) {
      return NextResponse.json(
        { error: "No se puede reagendar el mismo día de la cita porque ya está preparada." },
        { status: 400 },
      );
    }

    await db`
      UPDATE stylehub_client_appointments
      SET scheduled_at = ${nextScheduledAt.toISOString()},
          notes = ${notes},
          updated_at = NOW()
      WHERE id = ${appointmentId}
        AND client_user_id = ${auth.userId}
    `;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo reagendar la cita." }, { status: 500 });
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
