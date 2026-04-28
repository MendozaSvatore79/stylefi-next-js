"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
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

const supportTicketStorageKey = "stylehub-support-ticket-id";

function getLastSeenKey(ticketId: string) {
  return `stylehub-support-last-seen-${ticketId}`;
}

function getUnreadSupportMessages(messages: OracleMessage[], lastSeenAt: string | null) {
  if (!lastSeenAt) {
    return messages.filter((message) => message.role === "admin" || message.role === "system");
  }

  const lastSeenTime = new Date(lastSeenAt).getTime();
  if (Number.isNaN(lastSeenTime)) {
    return messages.filter((message) => message.role === "admin" || message.role === "system");
  }

  return messages.filter((message) => {
    if (message.role !== "admin" && message.role !== "system") {
      return false;
    }

    return new Date(message.createdAt).getTime() > lastSeenTime;
  });
}

export default function OracleSupportWidget() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<OracleMessage[]>([]);
  const [input, setInput] = useState("");
  const [subject, setSubject] = useState("Soporte AURA");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [showComposer, setShowComposer] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [ticketStatus, setTicketStatus] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const previousUnreadCountRef = useRef(0);
  const initialSyncDoneRef = useRef(false);
  const lastRenderedMessageIdRef = useRef<string | null>(null);

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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedTicketId = window.localStorage.getItem(supportTicketStorageKey)?.trim();
    if (storedTicketId) {
      setTicketId(storedTicketId);
    }
  }, []);

  useEffect(() => {
    previousUnreadCountRef.current = 0;
    initialSyncDoneRef.current = false;
    lastRenderedMessageIdRef.current = null;
  }, [ticketId]);

  useEffect(() => {
    if (!open || !ticketId || typeof window === "undefined") {
      return;
    }

    const lastMessageAt = messages[messages.length - 1]?.createdAt ?? null;
    if (!lastMessageAt) {
      return;
    }

    window.localStorage.setItem(getLastSeenKey(ticketId), lastMessageAt);
    setUnreadCount(0);
  }, [messages, open, ticketId]);

  const refreshTicket = useCallback(async (nextTicketId: string) => {
    try {
      const response = await fetch(`/api/support/oracle?ticketId=${encodeURIComponent(nextTicketId)}`, { cache: "no-store" });
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as OracleResponse;

      const nextMessages = payload.messages ?? [];
      setMessages(nextMessages);
  setTicketStatus(payload.ticket?.status ?? null);
      const newestMessageId = nextMessages.at(-1)?.id ?? null;
      setLastSyncedAt(new Date());

      if (typeof window !== "undefined") {
        const lastSeenAt = window.localStorage.getItem(getLastSeenKey(nextTicketId))?.trim() || null;
        const unreadMessages = getUnreadSupportMessages(nextMessages, lastSeenAt);
        const nextUnreadCount = open ? 0 : unreadMessages.length;

        if (!open && initialSyncDoneRef.current && nextUnreadCount > previousUnreadCountRef.current && nextUnreadCount > 0) {
          const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (AudioContextClass) {
            try {
              const audioContext = new AudioContextClass();
              const oscillator = audioContext.createOscillator();
              const gainNode = audioContext.createGain();

              oscillator.type = "sine";
              oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
              oscillator.frequency.exponentialRampToValueAtTime(660, audioContext.currentTime + 0.16);

              gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
              gainNode.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.02);
              gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.22);

              oscillator.connect(gainNode);
              gainNode.connect(audioContext.destination);
              oscillator.start();
              oscillator.stop(audioContext.currentTime + 0.24);
              oscillator.onended = () => {
                void audioContext.close();
              };
            } catch {
              // Ignore sound failures and keep the visual notification.
            }
          }
        }

        setUnreadCount(nextUnreadCount);
        previousUnreadCountRef.current = nextUnreadCount;
        initialSyncDoneRef.current = true;
        lastRenderedMessageIdRef.current = newestMessageId;
      }
    } catch {
      // Keep the last known chat state if refresh fails.
    }
  }, [open]);

  useEffect(() => {
    if (!ticketId) {
      return;
    }

    void refreshTicket(ticketId);
    const handleFocus = () => {
      void refreshTicket(ticketId);
    };

    window.addEventListener("focus", handleFocus);

    const intervalId = window.setInterval(() => {
      void refreshTicket(ticketId);
    }, open ? 5000 : 15000);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [open, refreshTicket, ticketId]);

  const canSend = useMemo(() => {
    if (!input.trim() || sending) {
      return false;
    }

    if (isAuthenticated) {
      return true;
    }

    return Boolean(contactName.trim() && contactEmail.trim());
  }, [contactEmail, contactName, input, isAuthenticated, sending]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const latestMessageId = messages.at(-1)?.id ?? null;
    if (!latestMessageId || latestMessageId === lastRenderedMessageIdRef.current) {
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    lastRenderedMessageIdRef.current = latestMessageId;
  }, [messages, open]);

  const lastSyncedLabel = useMemo(() => {
    if (!lastSyncedAt) {
      return { label: "Sincronizando", tone: "text-amber-700 bg-amber-50 border-amber-200" };
    }

    const diffMs = Date.now() - lastSyncedAt.getTime();
    const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));

    if (diffSeconds < 5) {
      return { label: "● En línea", tone: "text-emerald-700 bg-emerald-50 border-emerald-200" };
    }

    if (diffSeconds < 60) {
      return { label: `● Actualizado hace ${diffSeconds}s`, tone: "text-emerald-700 bg-emerald-50 border-emerald-200" };
    }

    const diffMinutes = Math.floor(diffSeconds / 60);
    return { label: `● Actualizado hace ${diffMinutes}m`, tone: "text-slate-600 bg-slate-50 border-slate-200" };
  }, [lastSyncedAt]);

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
      setTicketStatus(payload.ticket.status ?? null);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(supportTicketStorageKey, payload.ticket.id);
        window.localStorage.setItem(getLastSeenKey(payload.ticket.id), payload.messages?.at(-1)?.createdAt ?? new Date().toISOString());
      }
      setMessages(payload.messages ?? []);
      setUnreadCount(0);
      previousUnreadCountRef.current = 0;
      initialSyncDoneRef.current = true;
      lastRenderedMessageIdRef.current = payload.messages?.at(-1)?.id ?? null;
      setLastSyncedAt(new Date());
      setInput("");
      setShowComposer(false);

      if (payload.needsEscalation) {
        showToast({
          type: "info",
          title: "Ticket escalado",
          message: "AURA no pudo resolverlo por completo y un agente administrativo lo revisará.",
        });
      } else {
        showToast({
          type: "success",
          title: "Respuesta de AURA",
          message: "Tu consulta quedó registrada.",
        });
      }
    } catch (error) {
      showToast({
        type: "error",
        title: "AURA no pudo responder",
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

  const reopenComposer = () => {
    setShowComposer(true);
    setInput("");
  };

  const openNewTicket = () => {
    if (typeof window !== "undefined") {
      if (ticketId) {
        window.localStorage.removeItem(supportTicketStorageKey);
        window.localStorage.removeItem(getLastSeenKey(ticketId));
      }
    }

    setTicketId(null);
    setMessages([]);
    setInput("");
    setShowComposer(true);
    setTicketStatus(null);
    setUnreadCount(0);
    previousUnreadCountRef.current = 0;
    initialSyncDoneRef.current = false;
    lastRenderedMessageIdRef.current = null;
  };

  const updateTicketStatus = async (action: "confirm_close" | "reopen") => {
    if (!ticketId) {
      return;
    }

    setSending(true);
    try {
      const response = await fetch("/api/support/oracle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId,
          ticketAction: action,
        }),
      });

      const payload = (await response.json()) as OracleResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo actualizar el ticket.");
      }

      setTicketStatus(payload.ticket.status ?? null);
      setMessages(payload.messages ?? []);
      setLastSyncedAt(new Date());
      if (action === "confirm_close") {
        setUnreadCount(0);
      }
    } catch (error) {
      showToast({
        type: "error",
        title: "AURA no pudo actualizar el ticket",
        message: error instanceof Error ? error.message : "Intenta nuevamente.",
      });
    } finally {
      setSending(false);
    }
  };

  const statusLabel = useMemo(() => {
    if (ticketStatus === "resolved") {
      return { label: "Ticket resuelto", tone: "text-emerald-700 bg-emerald-50 border-emerald-200" };
    }

    if (ticketStatus === "closed") {
      return { label: "Ticket cerrado", tone: "text-slate-700 bg-slate-100 border-slate-200" };
    }

    return null;
  }, [ticketStatus]);

  const toggleWidget = () => {
    setOpen((current) => {
      const nextOpen = !current;

      if (nextOpen && ticketId) {
        void refreshTicket(ticketId);
      }

      return nextOpen;
    });
  };

  return (
    <>
      {!isAllowed ? null : (
        <div className="fixed bottom-2 right-2 z-50 sm:bottom-4 sm:right-4">
          {open ? (
            <div className="mb-3 flex h-[72vh] max-h-152 w-[calc(100vw-1rem)] max-w-md flex-col overflow-hidden rounded-3xl border border-blue-950/10 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.25)] sm:h-136 sm:w-96">
              <div className="flex items-center justify-between border-b border-slate-200 bg-[#0d1b3d] px-4 py-3 text-white">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">AURA</p>
                  <p className="text-sm font-bold">Soporte inteligente</p>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold hover:bg-white/15">
                  ✕
                </button>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
                {!isAuthenticated ? (
                  <div className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50 p-3 text-sm text-slate-700">
                    <div>
                      <p className="font-semibold text-[#0d1b3d]">Antes de empezar</p>
                      <p className="mt-1 text-xs text-slate-600">Si no has iniciado sesión, AURA necesita tu nombre y correo para levantar el ticket.</p>
                    </div>

                    <div className="space-y-3 rounded-2xl border border-white/70 bg-white/70 p-3">
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Nombre</span>
                        <input
                          type="text"
                          value={contactName}
                          onChange={(event) => setContactName(event.target.value)}
                          placeholder="Tu nombre"
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-200 focus:ring"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Correo</span>
                        <input
                          type="email"
                          value={contactEmail}
                          onChange={(event) => setContactEmail(event.target.value)}
                          placeholder="correo@ejemplo.com"
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-200 focus:ring"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Teléfono opcional</span>
                        <input
                          type="tel"
                          value={contactPhone}
                          onChange={(event) => setContactPhone(event.target.value)}
                          placeholder="55 1234 5678"
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-200 focus:ring"
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-slate-700">
                    <p className="font-semibold text-emerald-800">{displayName}</p>
                    <p className="text-xs text-emerald-700">{displayEmail}</p>
                  </div>
                )}

                {messages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    Escribe tu problema y AURA intentará resolverlo primero. Si no puede, lo escalará automáticamente.
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${message.role === "user" ? "ml-auto bg-blue-600 text-white" : message.role === "admin" ? "bg-amber-50 text-amber-900" : "bg-slate-100 text-slate-800"}`}
                    >
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">
                        {message.role === "oracle" ? "AURA" : message.role === "admin" ? "Agente" : message.role === "user" ? "Tú" : "Sistema"}
                      </p>
                      <p>{message.message}</p>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-slate-200 bg-slate-50 p-3">
                <div className={`mb-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${lastSyncedLabel.tone}`}>
                  <span className="text-[10px] leading-none">{lastSyncedLabel.label}</span>
                </div>
                {statusLabel ? (
                  <div className={`mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${statusLabel.tone}`}>
                    <span className="text-[10px] leading-none">{statusLabel.label}</span>
                  </div>
                ) : null}

                {ticketStatus === "closed" ? (
                  <div className="mb-3 space-y-3">
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                      Tu ticket está cerrado. Si necesitas algo más, puedes abrir uno nuevo desde este chat.
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={openNewTicket}
                        className="inline-flex h-10 items-center justify-center rounded-xl bg-[#0d1b3d] px-4 text-sm font-semibold text-white transition hover:bg-blue-800"
                      >
                        Abrir nuevo ticket
                      </button>
                      {ticketId ? <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Ticket #{ticketId}</span> : null}
                    </div>
                  </div>
                ) : null}

                {!showComposer ? (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                      Tu mensaje fue enviado. Puedes abrir el formulario otra vez si quieres agregar más detalles.
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={reopenComposer}
                        className="inline-flex h-10 items-center justify-center rounded-xl bg-[#0d1b3d] px-4 text-sm font-semibold text-white transition hover:bg-blue-800"
                      >
                        Escribir otro mensaje
                      </button>
                      {ticketId ? <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Ticket #{ticketId}</span> : null}
                    </div>
                  </div>
                ) : (
                  <>
                    <textarea
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={handleInputKeyDown}
                      placeholder="Describe tu duda..."
                      rows={2}
                      disabled={ticketStatus === "closed"}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-blue-200 focus:ring disabled:cursor-not-allowed disabled:bg-slate-100"
                    />
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-500">AURA guarda y puede escalar tu conversación.</span>
                      <button
                        type="button"
                        onClick={() => void sendMessage()}
                        disabled={!canSend || ticketStatus === "closed"}
                        className="inline-flex h-10 items-center justify-center rounded-xl bg-linear-to-r from-[#0d1b3d] to-blue-700 px-4 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {sending ? "Enviando..." : ticketId ? "Enviar" : "Consultar"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={toggleWidget}
            className={`relative inline-flex h-14 items-center gap-3 rounded-full bg-[#0d1b3d] px-5 text-white shadow-xl shadow-blue-950/20 transition hover:-translate-y-0.5 hover:bg-blue-800 ${unreadCount > 0 && !open ? "ring-2 ring-red-400/80 shadow-red-500/20 animate-pulse" : ""}`}
          >
            {unreadCount > 0 && !open ? (
              <span className="absolute -right-1 -top-1 inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white shadow-lg shadow-red-500/30 animate-bounce">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
            <span className="text-xl">◎</span>
            <span className="text-sm font-semibold">AURA</span>
          </button>
        </div>
      )}
    </>
  );
}
