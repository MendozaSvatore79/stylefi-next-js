import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";
import { sendSupportConversationEmail } from "@/lib/email";

export const runtime = "nodejs";

type SupportTicketRow = {
  id: string;
  requester_user_id: string | null;
  account_type: "cliente" | "negocio" | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  source_route: string | null;
  subject: string;
  status: string;
  escalated_to_admin: boolean;
  escalation_reason: string | null;
  oracle_summary: string | null;
  oracle_confidence: string | number | null;
  assigned_admin_email: string | null;
  last_message_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

type SupportMessageRow = {
  id: string;
  ticket_id: string;
  sender_role: "user" | "oracle" | "admin" | "system";
  sender_name: string | null;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

async function fetchMessages(ticketId: string) {
  const db = getDb();
  return (await db`
    SELECT id, ticket_id, sender_role, sender_name, message, metadata, created_at
    FROM stylehub_support_messages
    WHERE ticket_id = ${ticketId}
    ORDER BY created_at ASC
  `) as Array<SupportMessageRow>;
}

async function fetchTicket(ticketId: string) {
  const db = getDb();
  const [ticket] = (await db`
    SELECT *
    FROM stylehub_support_tickets
    WHERE id = ${ticketId}
    LIMIT 1
  `) as Array<SupportTicketRow>;

  return ticket ?? null;
}

export async function GET(request: Request) {
  await ensureStylehubSchema();
  const db = getDb();

  const url = new URL(request.url);
  const status = (url.searchParams.get("status") || "escalated").trim();
  const ticketId = url.searchParams.get("ticketId")?.trim();

  if (ticketId) {
    const ticket = await fetchTicket(ticketId);
    if (!ticket) {
      return NextResponse.json({ error: "No se encontró el ticket." }, { status: 404 });
    }

    const messages = await fetchMessages(ticketId);
    return NextResponse.json({ ticket, messages });
  }

  const safeStatus = ["open", "waiting_admin", "in_progress", "escalated", "resolved", "closed", "all"].includes(status)
    ? status
    : "escalated";

  const tickets = (await db`
    SELECT
      t.*,
      COUNT(m.id)::int AS message_count,
      MAX(m.created_at) AS last_message_created_at
    FROM stylehub_support_tickets t
    LEFT JOIN stylehub_support_messages m ON m.ticket_id = t.id
    ${safeStatus === "all" ? db`` : db`WHERE t.status = ${safeStatus}`}
    GROUP BY t.id
    ORDER BY t.updated_at DESC, t.created_at DESC
    LIMIT 100
  `) as Array<SupportTicketRow & { message_count: number; last_message_created_at: string | null }>;

  return NextResponse.json({ tickets });
}

export async function PATCH(request: Request) {
  await ensureStylehubSchema();
  const db = getDb();

  const payload = (await request.json()) as {
    ticketId?: string;
    action?: "reply" | "resolve" | "reopen";
    message?: string;
    adminEmail?: string;
  };

  const ticketId = payload.ticketId?.trim();
  if (!ticketId) {
    return NextResponse.json({ error: "Debes indicar un ticket." }, { status: 400 });
  }

  const ticket = await fetchTicket(ticketId);
  if (!ticket) {
    return NextResponse.json({ error: "No se encontró el ticket." }, { status: 404 });
  }

  const adminEmail = payload.adminEmail?.trim().toLowerCase() || ticket.assigned_admin_email || null;

  if (payload.action === "reply") {
    const message = payload.message?.trim();
    if (!message) {
      return NextResponse.json({ error: "Escribe una respuesta para enviar." }, { status: 400 });
    }

    await db`
      INSERT INTO stylehub_support_messages (ticket_id, sender_role, sender_name, message, metadata)
      VALUES (${ticketId}, 'admin', ${adminEmail || "Administrador"}, ${message}, ${JSON.stringify({ adminEmail })}::jsonb)
    `;

    await db`
      UPDATE stylehub_support_tickets
      SET status = 'in_progress',
          assigned_admin_email = COALESCE(${adminEmail}, assigned_admin_email),
          updated_at = NOW(),
          last_message_at = NOW()
      WHERE id = ${ticketId}
    `;
  }

  if (payload.action === "resolve") {
    await db`
      UPDATE stylehub_support_tickets
      SET status = 'resolved',
          resolved_at = NOW(),
          assigned_admin_email = COALESCE(${adminEmail}, assigned_admin_email),
          updated_at = NOW(),
          last_message_at = NOW()
      WHERE id = ${ticketId}
    `;
  }

  if (payload.action === "reopen") {
    await db`
      UPDATE stylehub_support_tickets
      SET status = 'in_progress',
          updated_at = NOW()
      WHERE id = ${ticketId}
    `;
  }

  const updatedTicket = await fetchTicket(ticketId);
  const messages = await fetchMessages(ticketId);

  if ((payload.action === "resolve" || payload.action === "reply" || payload.action === "reopen") && updatedTicket) {
    const transcript = messages.map((entry) => ({
      role: entry.sender_role,
      name: entry.sender_name,
      message: entry.message,
      createdAt: entry.created_at,
    }));

    await Promise.allSettled([
      sendSupportConversationEmail({
        to: updatedTicket.contact_email,
        subject: `Actualización de tu ticket #${updatedTicket.id}`,
        ticketId: updatedTicket.id,
        contactName: updatedTicket.contact_name,
        contactEmail: updatedTicket.contact_email,
        route: updatedTicket.source_route,
        summary: updatedTicket.oracle_summary,
        conversation: transcript,
      }),
      updatedTicket.assigned_admin_email
        ? sendSupportConversationEmail({
            to: updatedTicket.assigned_admin_email,
            subject: `Copia de soporte #${updatedTicket.id}`,
            ticketId: updatedTicket.id,
            contactName: updatedTicket.contact_name,
            contactEmail: updatedTicket.contact_email,
            route: updatedTicket.source_route,
            summary: updatedTicket.oracle_summary,
            conversation: transcript,
          })
        : Promise.resolve(),
    ]);
  }

  return NextResponse.json({ ticket: updatedTicket, messages });
}
