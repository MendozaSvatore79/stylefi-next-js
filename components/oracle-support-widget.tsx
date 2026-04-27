"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

import { useToast } from "@/components/toast";

type OracleMessage = {
  id: string;
  ticketId: string;
  role: "user" | "oracle" | "admin" | "system";
  name: string | null;
  message: string;
  createdAt: string;
};

type OracleResponse = {
  ticket: {
    id: string;
    status: string;
    contact_name: string;
    contact_email: string;
    subject: string;
  };
  messages: OracleMessage[];
  oracleReply?: string;
  needsEscalation?: boolean;
  error?: string;
};

function routeAllowed(pathname: string) {
  return pathname === "/" || pathname.startsWith("/dashboard/cliente") || pathname.startsWith("/dashboard/negocio");
}

export default function OracleSupportWidget() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<OracleMessage[]>([]);
  const [input, setInput] = useState("");
  const [subject, setSubject] = useState("Soporte Oracle");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [sending, setSending] = useState(false);

  const isAllowed = routeAllowed(pathname);
  const isAuthenticated = status === "authenticated";
  const displayName = session?.user?.name || session?.user?.email || "Usuario";
  const displayEmail = session?.user?.email || "";

  useEffect(() => {
    if (!isAllowed) {
      setOpen(false);
    }
  }, [isAllowed]);

  useEffect(() => {
    if (isAuthenticated) {
      setContactName(displayName);
      setContactEmail(displayEmail);
    }
  }, [displayEmail, displayName, isAuthenticated]);

  const canSend = useMemo(() => {
    if (!input.trim() || sending) {
      return false;
    }

    if (isAuthenticated) {
      return true;
    }

    return Boolean(contactName.trim() && contactEmail.trim());
  }, [contactEmail, contactName, input, isAuthenticated, sending]);

  if (!isAllowed) {
    return null;
  }

  const sendMessage = async () => {
    if (!canSend) {
      showToast({
        type: "error",
        title: "Faltan datos",
        message: isAuthenticated ? "Escribe tu duda para continuar." : "Completa nombre y correo antes de enviar.",
      });
      return;
    }

    setSending(true);
    try {
      const response = await fetch("/api/support/oracle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId,
          message: input,
          subject,
          contactName: isAuthenticated ? undefined : contactName,
          contactEmail: isAuthenticated ? undefined : contactEmail,
          contactPhone: isAuthenticated ? undefined : contactPhone || null,
          sourceRoute: pathname,
        }),
      });

      const payload = (await response.json()) as OracleResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo enviar tu mensaje.");
      }

      setTicketId(payload.ticket.id);
      setMessages(payload.messages ?? []);
      setInput("");

      if (payload.needsEscalation) {
        showToast({
          type: "info",
          title: "Ticket escalado",
          message: "Oracle no pudo resolverlo por completo y un agente administrativo lo revisará.",
        });
      } else {
        showToast({
          type: "success",
          title: "Respuesta de Oracle",
          message: "Tu consulta quedó registrada.",
        });
      }
    } catch (error) {
      showToast({
        type: "error",
        title: "Oracle no pudo responder",
        message: error instanceof Error ? error.message : "Intenta nuevamente.",
      });
    } finally {
      setSending(false);
    }
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    void sendMessage();
  };

  return (
    <div className="fixed bottom-2 right-2 z-50 sm:bottom-4 sm:right-4">
      {open ? (
        <div className="mb-3 flex h-[72vh] max-h-152 w-[calc(100vw-1rem)] max-w-md flex-col overflow-hidden rounded-3xl border border-blue-950/10 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.25)] sm:h-136 sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-200 bg-[#0d1b3d] px-4 py-3 text-white">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">Oracle</p>
              <p className="text-sm font-bold">Soporte inteligente</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold hover:bg-white/15">
              ✕
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {!isAuthenticated ? (
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-sm text-slate-700">
                <p className="font-semibold text-[#0d1b3d]">Antes de empezar</p>
                <p className="mt-1 text-xs text-slate-600">Si no has iniciado sesión, Oracle te pedirá nombre y correo para levantar el ticket.</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-slate-700">
                <p className="font-semibold text-emerald-800">{displayName}</p>
                <p className="text-xs text-emerald-700">{displayEmail}</p>
              </div>
            )}

            {messages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Escribe tu problema y Oracle intentará resolverlo primero. Si no puede, lo escalará automáticamente.
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${message.role === "user" ? "ml-auto bg-blue-600 text-white" : message.role === "admin" ? "bg-amber-50 text-amber-900" : "bg-slate-100 text-slate-800"}`}
                >
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">
                    {message.role === "oracle" ? "Oracle" : message.role === "admin" ? "Agente" : message.role === "user" ? "Tú" : "Sistema"}
                  </p>
                  <p>{message.message}</p>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-slate-200 bg-slate-50 p-3">
            {!isAuthenticated ? (
              <div className="mb-3 grid grid-cols-2 gap-2">
                <input
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                  placeholder="Nombre"
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-200 focus:ring"
                />
                <input
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  placeholder="Correo"
                  type="email"
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-200 focus:ring"
                />
                <input
                  value={contactPhone}
                  onChange={(event) => setContactPhone(event.target.value)}
                  placeholder="Teléfono"
                  type="tel"
                  className="col-span-2 h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-200 focus:ring"
                />
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Asunto"
                  className="col-span-2 h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-200 focus:ring"
                />
              </div>
            ) : null}

            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Describe tu duda..."
              rows={2}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-blue-200 focus:ring"
            />
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-500">Oracle guarda y puede escalar tu conversación.</span>
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={!canSend}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-linear-to-r from-[#0d1b3d] to-blue-700 px-4 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? "Enviando..." : ticketId ? "Enviar" : "Consultar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-14 items-center gap-3 rounded-full bg-[#0d1b3d] px-5 text-white shadow-xl shadow-blue-950/20 transition hover:-translate-y-0.5 hover:bg-blue-800"
      >
        <span className="text-xl">◎</span>
        <span className="text-sm font-semibold">Oracle</span>
      </button>
    </div>
  );
}
