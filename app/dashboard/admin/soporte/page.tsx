"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type SupportTicket = {
  id: string;
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
  message_count?: number;
  last_message_created_at?: string | null;
};

type SupportMessage = {
  id: string;
  sender_role: "user" | "oracle" | "admin" | "system";
  sender_name: string | null;
  message: string;
  created_at: string;
};

const statusLabel: Record<string, string> = {
  open: "Abierto",
  waiting_admin: "Esperando admin",
  in_progress: "En seguimiento",
  escalated: "Escalado",
  resolved: "Resuelto",
  closed: "Cerrado",
};

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [filter, setFilter] = useState("escalated");
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [sending, setSending] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/support-tickets?status=${encodeURIComponent(filter)}`, { cache: "no-store" });
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as { tickets?: SupportTicket[] };
      setTickets(payload.tickets ?? []);
      if (!selectedTicketId && payload.tickets?.length) {
        setSelectedTicketId(payload.tickets[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [filter, selectedTicketId]);

  const loadTicket = async (ticketId: string) => {
    const response = await fetch(`/api/admin/support-tickets?ticketId=${encodeURIComponent(ticketId)}`, { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { ticket?: SupportTicket; messages?: SupportMessage[] };
    setSelectedTicket(payload.ticket ?? null);
    setMessages(payload.messages ?? []);
    setReply("");
    setAdminEmail(payload.ticket?.assigned_admin_email ?? "");
  };

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    if (selectedTicketId) {
      void loadTicket(selectedTicketId);
    }
  }, [selectedTicketId]);

  const ticketStats = useMemo(() => ({
    escalated: tickets.filter((ticket) => ticket.status === "escalated").length,
    inProgress: tickets.filter((ticket) => ticket.status === "in_progress").length,
    resolved: tickets.filter((ticket) => ticket.status === "resolved").length,
  }), [tickets]);

  const sendReply = async (action: "reply" | "resolve") => {
    if (!selectedTicket) {
      return;
    }

    if (action === "reply" && !reply.trim()) {
      return;
    }

    setSending(true);
    try {
      const response = await fetch("/api/admin/support-tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: selectedTicket.id,
          action,
          message: reply,
          adminEmail,
        }),
      });

      if (!response.ok) {
        return;
      }

      await loadTickets();
      await loadTicket(selectedTicket.id);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Soporte Oracle</CardTitle>
          <CardDescription>Tickets escalados desde el bot, con historial y respuesta del equipo administrativo.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Escalados</p>
            <p className="mt-1 text-3xl font-black text-slate-900">{ticketStats.escalated}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">En seguimiento</p>
            <p className="mt-1 text-3xl font-black text-slate-900">{ticketStats.inProgress}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Resueltos</p>
            <p className="mt-1 text-3xl font-black text-slate-900">{ticketStats.resolved}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card className="min-h-120">
          <CardHeader>
            <CardTitle>Tickets</CardTitle>
            <CardDescription>Filtra y abre la conversación escalada.</CardDescription>
            <select value={filter} onChange={(event) => setFilter(event.target.value)} className="mt-2 h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-indigo-200 focus:ring">
              <option value="escalated">Escalados</option>
              <option value="open">Abiertos</option>
              <option value="waiting_admin">Esperando admin</option>
              <option value="in_progress">En seguimiento</option>
              <option value="resolved">Resueltos</option>
              <option value="all">Todos</option>
            </select>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? <p className="text-sm text-slate-500">Cargando tickets...</p> : null}
            {tickets.map((ticket) => (
              <button
                key={ticket.id}
                type="button"
                onClick={() => setSelectedTicketId(ticket.id)}
                className={`w-full rounded-2xl border p-4 text-left transition ${selectedTicketId === ticket.id ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{ticket.contact_name}</p>
                  <Badge variant="secondary">{statusLabel[ticket.status] || ticket.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-600">{ticket.subject}</p>
                <p className="mt-1 text-xs text-slate-500">{ticket.contact_email}</p>
              </button>
            ))}
            {!loading && tickets.length === 0 ? <p className="text-sm text-slate-500">No hay tickets para este filtro.</p> : null}
          </CardContent>
        </Card>

        <Card className="min-h-120">
          <CardHeader>
            <CardTitle>Detalle del ticket</CardTitle>
            <CardDescription>{selectedTicket ? `${selectedTicket.contact_name} · ${selectedTicket.subject}` : "Selecciona un ticket para ver la conversación."}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedTicket ? (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Contacto</p>
                    <p className="mt-1 font-semibold text-slate-900">{selectedTicket.contact_name}</p>
                    <p className="text-slate-600">{selectedTicket.contact_email}</p>
                    <p className="text-slate-500">{selectedTicket.contact_phone || "Sin teléfono"}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">IA Oracle</p>
                    <p className="mt-1 font-semibold text-slate-900">{selectedTicket.oracle_summary || "Sin resumen"}</p>
                    <p className="text-slate-500">Confianza: {selectedTicket.oracle_confidence ?? "n/a"}</p>
                    <p className="text-slate-500">Ruta: {selectedTicket.source_route || "n/a"}</p>
                  </div>
                </div>

                <div className="max-h-72 space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  {messages.map((message) => (
                    <div key={message.id} className={`rounded-2xl px-3 py-2 text-sm ${message.sender_role === "admin" ? "bg-amber-50 text-amber-900" : message.sender_role === "oracle" ? "bg-white text-slate-800" : "bg-blue-600 text-white"}`}>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">
                        {message.sender_role === "oracle" ? "Oracle" : message.sender_role === "admin" ? "Agente" : message.sender_role === "system" ? "Sistema" : "Usuario"}
                      </p>
                      <p>{message.message}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <textarea
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder="Responder al usuario..."
                    className="min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-indigo-200 focus:ring"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <input value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} placeholder="Correo del agente" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-indigo-200 focus:ring" />
                    <Button disabled={sending} onClick={() => void sendReply("reply")}>Enviar respuesta</Button>
                    <Button variant="secondary" disabled={sending} onClick={() => void sendReply("resolve")}>Marcar resuelto</Button>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">No hay ticket seleccionado.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
