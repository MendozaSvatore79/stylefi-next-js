import { NextResponse } from "next/server";

import { getCurrentSupportUser } from "@/app/api/support/_current-user";
import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";
import { oracleRespond } from "@/lib/oracle-support";
import { sendSupportConversationEmail } from "@/lib/email";
import { getOptionalEnv } from "@/lib/env";

export const runtime = "nodejs";

type SupportMessage = {
  id: string;
  ticket_id: string;
  sender_role: "user" | "oracle" | "admin" | "system";
  sender_name: string | null;
  message: string;
  created_at: string;
};

type SupportTicket = {
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

function mapMessages(messages: Array<SupportMessage>) {
  return messages.map((message) => ({
    id: message.id,
    ticketId: message.ticket_id,
    role: message.sender_role,
    name: message.sender_name,
    message: message.message,
    createdAt: message.created_at,
  }));
}

async function loadTicketWithMessages(ticketId: string) {
  await ensureStylehubSchema();
  const db = getDb();

  const [ticket] = (await db`
    SELECT *
    FROM stylehub_support_tickets
    WHERE id = ${ticketId}
    LIMIT 1
  `) as Array<SupportTicket>;

  if (!ticket) {
    return null;
  }

  const messages = (await db`
    SELECT id, ticket_id, sender_role, sender_name, message, created_at
    FROM stylehub_support_messages
    WHERE ticket_id = ${ticketId}
    ORDER BY created_at ASC
  `) as Array<SupportMessage>;

  return { ticket, messages };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ticketId = url.searchParams.get("ticketId")?.trim();

  if (!ticketId) {
    return NextResponse.json({ error: "Debes indicar un ticket." }, { status: 400 });
  }

  const result = await loadTicketWithMessages(ticketId);
  if (!result) {
    return NextResponse.json({ error: "No se encontró el ticket." }, { status: 404 });
  }

  return NextResponse.json({
    ticket: result.ticket,
    messages: mapMessages(result.messages),
  });
}

async function appendSystemMessage(ticketId: string, message: string) {
  const db = getDb();

  await db`
    INSERT INTO stylehub_support_messages (
      ticket_id,
      sender_role,
      sender_name,
      message,
      metadata
    )
    VALUES (
      ${ticketId},
      'system',
      'Sistema',
      ${message},
      ${JSON.stringify({ type: 'ticket_status_update' })}::jsonb
    )
  `;
}

export async function POST(request: Request) {
  const currentUser = await getCurrentSupportUser();
  const payload = (await request.json()) as {
    ticketId?: string;
    message?: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    subject?: string;
    sourceRoute?: string;
    ticketAction?: "confirm_close" | "reopen";
  };

  if (payload.ticketAction) {
    const ticketId = payload.ticketId?.trim();
    if (!ticketId) {
      return NextResponse.json({ error: "Debes indicar un ticket." }, { status: 400 });
    }

    await ensureStylehubSchema();
    const db = getDb();
    const [ticket] = (await db`
      SELECT *
      FROM stylehub_support_tickets
      WHERE id = ${ticketId}
      LIMIT 1
    `) as Array<SupportTicket>;

    if (!ticket) {
      return NextResponse.json({ error: "No se encontró el ticket." }, { status: 404 });
    }

    if (payload.ticketAction === "confirm_close") {
      await db`
        UPDATE stylehub_support_tickets
        SET status = 'closed',
            resolved_at = COALESCE(resolved_at, NOW()),
            updated_at = NOW(),
            last_message_at = NOW()
        WHERE id = ${ticketId}
      `;

      await appendSystemMessage(ticketId, "El cliente confirmó el cierre del ticket y quedó marcado como cerrado.");
    }

    if (payload.ticketAction === "reopen") {
      await db`
        UPDATE stylehub_support_tickets
        SET status = 'in_progress',
            resolved_at = NULL,
            updated_at = NOW(),
            last_message_at = NOW()
        WHERE id = ${ticketId}
      `;

      await appendSystemMessage(ticketId, "El cliente solicitó reabrir el ticket para seguimiento adicional.");
    }

    const updated = await loadTicketWithMessages(ticketId);
    if (!updated) {
      return NextResponse.json({ error: "No se pudo actualizar el ticket." }, { status: 500 });
    }

    return NextResponse.json({
      ticket: updated.ticket,
      messages: mapMessages(updated.messages),
      oracleReply: null,
      needsEscalation: false,
    });
  }

  const message = payload.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "Escribe tu duda para continuar." }, { status: 400 });
  }

  const contactName = currentUser?.name || payload.contactName?.trim();
  const contactEmail = currentUser?.email || payload.contactEmail?.trim().toLowerCase();
  const contactPhone = currentUser?.phone || payload.contactPhone?.trim() || null;
  const subject = payload.subject?.trim() || "Soporte AURA";
  const sourceRoute = payload.sourceRoute?.trim() || null;

  if (!contactName || !contactEmail) {
    return NextResponse.json({ error: "Debes indicar nombre y correo para levantar el ticket." }, { status: 400 });
  }

  await ensureStylehubSchema();
  const db = getDb();

  let ticketId = payload.ticketId?.trim() || null;
  let ticket = null as SupportTicket | null;
  let isNewTicket = false;

  if (ticketId) {
    const existing = await loadTicketWithMessages(ticketId);
    if (!existing) {
      return NextResponse.json({ error: "No se encontró el ticket." }, { status: 404 });
    }
    ticket = existing.ticket;
  }

  if (!ticket) {
    const [createdTicket] = (await db`
      INSERT INTO stylehub_support_tickets (
        requester_user_id,
        account_type,
        contact_name,
        contact_email,
        contact_phone,
        source_route,
        subject,
        status,
        last_message_at,
        updated_at
      )
      VALUES (
        ${currentUser?.id || null},
        ${currentUser?.accountType || null},
        ${contactName},
        ${contactEmail},
        ${contactPhone},
        ${sourceRoute},
        ${subject},
        'open',
        NOW(),
        NOW()
      )
      RETURNING *
    `) as Array<SupportTicket>;

    ticket = createdTicket;
    ticketId = createdTicket.id;
    isNewTicket = true;
  }

  if (!ticketId) {
    return NextResponse.json({ error: "No se pudo crear el ticket de soporte." }, { status: 500 });
  }

  await db`
    INSERT INTO stylehub_support_messages (
      ticket_id,
      sender_role,
      sender_name,
      message,
      metadata
    )
    VALUES (
      ${ticketId},
      'user',
      ${contactName},
      ${message},
      ${JSON.stringify({ sourceRoute, contactEmail })}::jsonb
    )
  `;

  const historyRows = (await db`
    SELECT sender_role, message
    FROM stylehub_support_messages
    WHERE ticket_id = ${ticketId}
    ORDER BY created_at ASC
    LIMIT 40
  `) as Array<{ sender_role: "user" | "oracle" | "admin" | "system"; message: string }>;

  const oracleDecision = await oracleRespond({
    subject,
    latestMessage: message,
    ticketId,
    memorySummary: ticket?.oracle_summary ?? null,
    accountType: currentUser?.accountType ?? ticket?.account_type ?? null,
    history: historyRows.map((entry) => ({
      role: entry.sender_role,
      message: entry.message,
    })),
  });

  await db`
    INSERT INTO stylehub_support_messages (
      ticket_id,
      sender_role,
      sender_name,
      message,
      metadata
    )
    VALUES (
      ${ticketId},
      'oracle',
      'AURA',
      ${oracleDecision.reply},
      ${JSON.stringify({ category: oracleDecision.category, confidence: oracleDecision.confidence, needsEscalation: oracleDecision.needsEscalation })}::jsonb
    )
  `;

  const [ticketRow] = (await db`
    SELECT *
    FROM stylehub_support_tickets
    WHERE id = ${ticketId}
    LIMIT 1
  `) as Array<SupportTicket>;

  const shouldEscalate = oracleDecision.needsEscalation && ticketRow.status !== "escalated";
  const assignedAdminEmail = getOptionalEnv("SUPPORT_ADMIN_EMAIL")?.trim() || null;

  if (shouldEscalate) {
    await db`
      UPDATE stylehub_support_tickets
      SET status = 'escalated',
          escalated_to_admin = TRUE,
          escalation_reason = ${oracleDecision.escalationReason || "AURA no pudo resolver el caso automáticamente."},
          oracle_summary = ${oracleDecision.summary},
          oracle_confidence = ${oracleDecision.confidence},
          assigned_admin_email = ${assignedAdminEmail},
          last_message_at = NOW(),
          updated_at = NOW()
      WHERE id = ${ticketId}
    `;

    await db`
      INSERT INTO stylehub_support_messages (
        ticket_id,
        sender_role,
        sender_name,
        message,
        metadata
      )
      VALUES (
        ${ticketId},
        'system',
        'Sistema',
        ${`Tu caso fue escalado. Tu número de ticket es #${ticketId}. Un agente administrativo lo revisará y te responderá por este mismo chat.`},
        ${JSON.stringify({ type: "ticket_escalated", ticketId })}::jsonb
      )
    `;
  } else {
    await db`
      UPDATE stylehub_support_tickets
      SET status = CASE WHEN status IN ('open', 'waiting_admin') THEN 'open' ELSE status END,
          oracle_summary = ${oracleDecision.summary},
          oracle_confidence = ${oracleDecision.confidence},
          last_message_at = NOW(),
          updated_at = NOW()
      WHERE id = ${ticketId}
    `;
  }

  const updated = await loadTicketWithMessages(ticketId);
  if (!updated) {
    return NextResponse.json({ error: "No se pudo actualizar el ticket." }, { status: 500 });
  }

  const transcript = updated.messages.map((entry) => ({
    role: entry.sender_role,
    name: entry.sender_name,
    message: entry.message,
    createdAt: entry.created_at,
  }));

  const supportAdminEmail = assignedAdminEmail || getOptionalEnv("SUPPORT_ADMIN_EMAIL")?.trim() || getOptionalEnv("ADMIN_EMAIL")?.trim() || null;
  const notificationSubject = isNewTicket
    ? `Nuevo ticket de soporte #${ticketId}`
    : shouldEscalate
      ? `AURA escaló tu ticket #${ticketId}`
      : `Actualización de tu ticket #${ticketId}`;

  const notificationSummary = shouldEscalate ? oracleDecision.summary : updated.ticket.oracle_summary;

  await Promise.allSettled([
    sendSupportConversationEmail({
      to: contactEmail,
      subject: notificationSubject,
      ticketId,
      contactName,
      contactEmail,
      route: sourceRoute,
      summary: notificationSummary,
      conversation: transcript,
    }),
    supportAdminEmail
      ? sendSupportConversationEmail({
          to: supportAdminEmail,
          subject: isNewTicket ? `Nuevo ticket de soporte #${ticketId}` : `Actualización de ticket #${ticketId}`,
          ticketId,
          contactName,
          contactEmail,
          route: sourceRoute,
          summary: notificationSummary,
          conversation: transcript,
        })
      : Promise.resolve(),
  ]);

  return NextResponse.json({
    ticket: updated.ticket,
    messages: mapMessages(updated.messages),
    oracleReply: oracleDecision.reply,
    needsEscalation: oracleDecision.needsEscalation,
  });
}
