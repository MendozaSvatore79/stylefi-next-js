"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/components/toast";
import { colorEstado, etiquetaEstado, fechaHoraCita, puedeModificarCliente } from "@stylefi/shared";
import { useLanguage } from "@/lib/language-context";
import TimeSlotPicker from "@/components/time-slot-picker";
import { api } from "@/lib/api";

type Business = {
  id: string;
  business_name: string | null;
  first_name: string | null;
  last_name: string | null;
  salon_name: string | null;
};

type Wallet = {
  balance: string;
};

type Appointment = {
  id: string;
  service_name: string;
  scheduled_at: string;
  status: string;
  total_amount: string;
  notes?: string | null;
  business_name: string | null;
  first_name: string | null;
  last_name: string | null;
  business_user_id: string;
  service_id: string | null;
  branch_id: string | null;
  stylist_id: string | null;
  stylist_first_name: string | null;
  stylist_last_name: string | null;
};

type Service = {
  id: string;
  service_name: string;
  description: string | null;
  price: number | string;
};

type Stylist = {
  id: string;
  first_name: string;
  last_name: string;
  specialization: string;
  available?: boolean;
  service_ids?: string[];
};

export default function ClienteCitasPage() {
  const { showToast } = useToast();
  const { t, language } = useLanguage();
  const searchParams = useSearchParams();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [stylists, setStylists] = useState<Stylist[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  const [editScheduledAt, setEditScheduledAt] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [cancellingAppointmentId, setCancellingAppointmentId] = useState<string | null>(null);
  const [deletingAppointmentId, setDeletingAppointmentId] = useState<string | null>(null);
  const [isClearingPastHistory, setIsClearingPastHistory] = useState(false);
  const [isDeletingAllAppointments, setIsDeletingAllAppointments] = useState(false);
  const [form, setForm] = useState({
    businessUserId: "",
    serviceName: "",
    serviceId: "",
    stylistId: "",
    scheduledAt: "",
    totalAmount: "",
    paymentProvider: "cash" as "cash" | "wallet",
    notes: "",
  });

  const loadBusinessCatalog = async (businessId: string) => {
    if (!businessId) {
      setServices([]);
      setStylists([]);
      setForm((current) => ({
        ...current,
        serviceId: "",
        serviceName: "",
        stylistId: "",
      }));
      return;
    }

    try {
      const response = await api(`/api/businesses?businessId=${businessId}`, { cache: "no-store" });
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as {
        services: Service[];
        stylists: Stylist[];
      };

      setServices(payload.services ?? []);
      setStylists(payload.stylists ?? []);
    } catch (error) {
      console.error("Error cargando catálogo del negocio:", error);
    }
  };

  const loadData = async () => {
    const [businessesResponse, methodsResponse, appointmentsResponse] = await Promise.all([
      api("/api/businesses", { cache: "no-store" }),
      api("/api/client/payment-methods", { cache: "no-store" }),
      api("/api/client/appointments", { cache: "no-store" }),
    ]);

    if (businessesResponse.ok) {
      const payload = (await businessesResponse.json()) as { businesses: Business[] };
      setBusinesses(payload.businesses ?? []);
    }

    if (methodsResponse.ok) {
      const payload = (await methodsResponse.json()) as { wallet?: Wallet };
      setWallet(payload.wallet ?? null);
    }

    if (appointmentsResponse.ok) {
      const payload = (await appointmentsResponse.json()) as { appointments: Appointment[] };
      setAppointments(payload.appointments ?? []);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  // Cargar negocio preseleccionado si viene del modal de salones
  useEffect(() => {
    const negocioId = searchParams.get("negocio");
    if (negocioId) {
      setForm((prevForm) => ({
        ...prevForm,
        businessUserId: negocioId,
      }));
    }
  }, [searchParams]);

  useEffect(() => {
    void loadBusinessCatalog(form.businessUserId);
  }, [form.businessUserId]);

  // Al reagendar se elige un horario libre del selector (el servidor solo acepta horarios ofrecidos)
  const openReschedule = (appointment: Appointment) => {
    setEditingAppointmentId(appointment.id);
    setEditDate("");
    setEditScheduledAt("");
    setEditNotes(appointment.notes ?? "");
  };

  const closeReschedule = () => {
    setEditingAppointmentId(null);
    setEditDate("");
    setEditScheduledAt("");
    setEditNotes("");
  };

  const handleReschedule = async (appointmentId: string) => {
    if (!editScheduledAt) {
      showToast({
        type: "error",
        title: copy.rescheduleRequired,
        message: copy.rescheduleRequiredMsg,
      });
      return;
    }

    setIsSavingEdit(true);

    try {
      const response = await api("/api/client/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId,
          scheduledAt: editScheduledAt,
          notes: editNotes,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? copy.rescheduleErrorMsg);
      }

      showToast({
        type: "success",
        title: copy.rescheduled,
        message: copy.rescheduledMsg,
      });

      closeReschedule();
      await loadData();
    } catch (error) {
      showToast({
        type: "error",
        title: copy.rescheduleError,
        message: error instanceof Error ? error.message : copy.tryAgain,
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteAppointment = async (appointmentId: string) => {
    const confirmed = window.confirm(copy.deleteConfirm);
    if (!confirmed) {
      return;
    }

    setDeletingAppointmentId(appointmentId);

    try {
      const response = await api("/api/client/appointments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? copy.deleteErrorMsg);
      }

      showToast({
        type: "success",
        title: copy.deleted,
        message: copy.deletedMsg,
      });

      await loadData();
    } catch (error) {
      showToast({
        type: "error",
        title: copy.deleteError,
        message: error instanceof Error ? error.message : copy.tryAgain,
      });
    } finally {
      setDeletingAppointmentId(null);
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    const confirmed = window.confirm(language === "en" ? "Are you sure you want to cancel this appointment?" : "¿Seguro que deseas cancelar esta cita?");
    if (!confirmed) {
      return;
    }

    setCancellingAppointmentId(appointmentId);

    try {
      const response = await api("/api/client/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId,
          status: "cancelled",
        }),
      });

      const payload = (await response.json()) as { error?: string; refund?: number };
      if (!response.ok) {
        throw new Error(payload.error ?? (language === "en" ? "Could not cancel appointment." : "No se pudo cancelar la cita."));
      }

      const reembolso = Number(payload.refund ?? 0);
      showToast({
        type: "success",
        title: language === "en" ? "Appointment cancelled" : "Cita cancelada",
        message:
          reembolso > 0
            ? language === "en"
              ? `We returned $${reembolso.toFixed(2)} to your wallet.`
              : `Te devolvimos $${reembolso.toFixed(2)} a tu wallet.`
            : language === "en"
              ? "The appointment was marked as cancelled."
              : "La cita se marcó como cancelada.",
      });

      if (editingAppointmentId === appointmentId) {
        closeReschedule();
      }

      await loadData();
    } catch (error) {
      showToast({
        type: "error",
        title: language === "en" ? "Could not cancel" : "No se pudo cancelar",
        message: error instanceof Error ? error.message : (language === "en" ? "Try again." : "Intenta nuevamente."),
      });
    } finally {
      setCancellingAppointmentId(null);
    }
  };

  const handleClearPastHistory = async () => {
    const confirmed = window.confirm(
      language === "en"
        ? "This will delete only past, completed, or cancelled appointments. Continue?"
        : "Esto borrará solo citas pasadas, completadas o canceladas. ¿Deseas continuar?",
    );
    if (!confirmed) {
      return;
    }

    setIsClearingPastHistory(true);

    try {
      const response = await api("/api/client/appointments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearMode: "past" }),
      });

      const payload = (await response.json()) as { error?: string; deletedCount?: number };
      if (!response.ok) {
        throw new Error(payload.error ?? copy.clearPastErrorMsg);
      }

      showToast({
        type: "success",
        title: copy.clearPastTitle,
        message:
          language === "en"
            ? `Deleted ${payload.deletedCount ?? 0} past/completed/cancelled appointment(s).`
            : `Se borraron ${payload.deletedCount ?? 0} cita(s) pasadas/completadas/canceladas.`,
      });

      await loadData();
    } catch (error) {
      showToast({
        type: "error",
        title: copy.clearPastError,
        message: error instanceof Error ? error.message : copy.tryAgain,
      });
    } finally {
      setIsClearingPastHistory(false);
    }
  };

  const handleDeleteAllAppointments = async () => {
    const confirmed = window.confirm(copy.clearAllConfirm);
    if (!confirmed) {
      return;
    }

    setIsDeletingAllAppointments(true);

    try {
      const response = await api("/api/client/appointments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearMode: "all" }),
      });

      const payload = (await response.json()) as { error?: string; deletedCount?: number };
      if (!response.ok) {
        throw new Error(payload.error ?? copy.clearAllErrorMsg);
      }

      showToast({
        type: "success",
        title: copy.deletedAll,
        message:
          language === "en"
            ? `Deleted ${payload.deletedCount ?? 0} appointment(s) in total.`
            : `Se borraron ${payload.deletedCount ?? 0} cita(s) en total.`,
      });

      await loadData();
    } catch (error) {
      showToast({
        type: "error",
        title: copy.clearAllError,
        message: error instanceof Error ? error.message : copy.tryAgain,
      });
    } finally {
      setIsDeletingAllAppointments(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.businessUserId || !form.serviceId || !form.scheduledAt) {
      showToast({
        type: "error",
        title: copy.completeAppointment,
        message: copy.selectBusinessServiceDate,
      });
      return;
    }

    if (form.paymentProvider === "wallet" && wallet && Number(wallet.balance) < Number(form.totalAmount)) {
      showToast({
        type: "error",
        title: copy.insufficientBalance,
        message: copy.insufficientBalanceMsg,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await api("/api/client/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // El precio y el nombre del servicio los fija el servidor; solo se manda qué servicio y cuándo
        body: JSON.stringify({
          businessUserId: form.businessUserId,
          serviceId: form.serviceId,
          stylistId: form.stylistId,
          scheduledAt: form.scheduledAt,
          paymentProvider: form.paymentProvider,
          notes: form.notes,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? copy.scheduleErrorMsg);
      }

      showToast({
        type: "success",
        title: copy.scheduled,
        message: copy.scheduledMsg,
      });

      setForm({
        businessUserId: "",
        serviceName: "",
        serviceId: "",
        stylistId: "",
        scheduledAt: "",
        totalAmount: "",
        paymentProvider: "cash",
        notes: "",
      });
      await loadData();
    } catch (error) {
      showToast({
        type: "error",
        title: copy.scheduleError,
        message: error instanceof Error ? error.message : copy.tryAgain,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copy = {
    rescheduleRequired: language === "en" ? "Date required" : "Fecha requerida",
    rescheduleRequiredMsg: language === "en" ? "Select the new date and time to reschedule." : "Selecciona la nueva fecha y hora para reagendar.",
    rescheduleError: language === "en" ? "Could not reschedule" : "No se pudo reagendar",
    rescheduleErrorMsg: language === "en" ? "Could not reschedule appointment." : "No se pudo reagendar la cita.",
    rescheduled: language === "en" ? "Appointment rescheduled" : "Cita reagendada",
    rescheduledMsg: language === "en" ? "The appointment was updated successfully." : "La cita se actualizó correctamente.",
    deleteConfirm: language === "en" ? "Are you sure you want to delete this appointment from history?" : "¿Seguro que deseas borrar esta cita del historial?",
    deleteError: language === "en" ? "Could not delete" : "No se pudo borrar",
    deleteErrorMsg: language === "en" ? "Could not delete appointment." : "No se pudo borrar la cita.",
    deleted: language === "en" ? "Appointment deleted" : "Cita borrada",
    deletedMsg: language === "en" ? "Removed from history." : "Se eliminó del historial.",
    clearPastConfirm: language === "en" ? "This will delete all past appointments (past, completed, or cancelled). Continue?" : "¿Seguro que deseas limpiar solo el historial pasado (pasadas/completadas/canceladas)?",
    clearPastError: language === "en" ? "Could not clear history" : "No se pudo limpiar",
    clearPastErrorMsg: language === "en" ? "Could not clear history." : "No se pudo limpiar el historial.",
    clearPastTitle: language === "en" ? "Past history cleared" : "Historial pasado limpiado",
    clearPastMsg: language === "en" ? `Deleted ${0} past/completed/cancelled appointment(s).` : `Se borraron ${0} cita(s) pasadas/completadas/canceladas.`,
    clearAllConfirm: language === "en" ? "This will DELETE ALL your appointments, including upcoming and pending ones. Do you want to continue?" : "Esto borrará TODAS tus citas, incluyendo próximas y pendientes. ¿Deseas continuar?",
    clearAllError: language === "en" ? "Could not delete all" : "No se pudo borrar todo",
    clearAllErrorMsg: language === "en" ? "Could not delete all appointments." : "No se pudieron borrar todas las citas.",
    deletedAll: language === "en" ? "Appointments deleted" : "Citas eliminadas",
    deletedAllMsg: language === "en" ? `Deleted ${0} appointment(s) in total.` : `Se borraron ${0} cita(s) en total.`,
    completeAppointment: language === "en" ? "Complete your appointment" : "Completa tu cita",
    selectBusinessServiceDate: language === "en" ? "Select business, service, and date/time." : "Selecciona negocio, servicio y fecha/hora.",
    insufficientBalance: language === "en" ? "Insufficient balance" : "Saldo insuficiente",
    insufficientBalanceMsg: language === "en" ? "You don't have enough balance to schedule this appointment with wallet." : "No tienes saldo suficiente para agendar esta cita con wallet.",
    scheduled: language === "en" ? "Appointment scheduled" : "Cita agendada",
    scheduledMsg: language === "en" ? "The reservation was created successfully." : "La reserva se creó correctamente.",
    scheduleError: language === "en" ? "Could not schedule" : "No se pudo agendar",
    scheduleErrorMsg: language === "en" ? "Could not schedule appointment." : "No se pudo agendar la cita.",
    tryAgain: language === "en" ? "Try again." : "Intenta nuevamente.",
  };

  return (
    <section className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
      <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{language === "en" ? "Booking" : "Reserva"}</p>
        <h2 className="mt-2 text-2xl font-black text-[#151138]">{language === "en" ? "Schedule new appointment" : "Agendar nueva cita"}</h2>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">{t("appointments.business")}</label>
            <select
              value={form.businessUserId}
              onChange={(event) => {
                const selectedBusinessId = event.target.value;
                setForm((current) => ({
                  ...current,
                  businessUserId: selectedBusinessId,
                  serviceId: "",
                  serviceName: "",
                  stylistId: "",
                  totalAmount: "",
                }));
              }}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-indigo-300 focus:ring"
            >
              <option value="">{t("appointments.selectBusiness")}</option>
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.business_name ||
                    `${business.first_name ?? ""} ${business.last_name ?? ""}`.trim() ||
                    (language === "en" ? "Business" : "Negocio")}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={form.serviceId}
              onChange={(event) => {
                const selectedServiceId = event.target.value;
                const selectedService = services.find((service) => service.id === selectedServiceId);

                setForm((current) => ({
                  ...current,
                  serviceId: selectedServiceId,
                  serviceName: selectedService?.service_name ?? "",
                  totalAmount: selectedService ? String(Number(selectedService.price)) : "",
                }));
              }}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-indigo-300 focus:ring"
            >
              <option value="">{language === "en" ? "Select a service" : "Selecciona un servicio"}</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.service_name} · ${Number(service.price).toFixed(2)}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={form.scheduledAt.split("T")[0] || ""}
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  scheduledAt: event.target.value ? `${event.target.value}T00:00` : "",
                }));
              }}
              min={new Date().toISOString().split("T")[0]}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-indigo-300 focus:ring"
            />
          </div>

          {form.businessUserId && form.serviceId && form.scheduledAt.split("T")[0] && (
            <TimeSlotPicker
              key={`${form.serviceId}-${form.stylistId}-${form.scheduledAt.split("T")[0]}`}
              businessUserId={form.businessUserId}
              serviceId={form.serviceId}
              stylistId={form.stylistId || null}
              selectedDate={form.scheduledAt.split("T")[0]}
              onSelectTime={(isoDateTime) => {
                setForm((current) => ({
                  ...current,
                  scheduledAt: isoDateTime,
                }));
              }}
            />
          )}

          <select
            value={form.stylistId}
            onChange={(event) =>
              // Cambiar de estilista cambia los horarios libres: se conserva el día y se vuelve a elegir la hora
              setForm((current) => ({ ...current, stylistId: event.target.value, scheduledAt: current.scheduledAt.split("T")[0] }))
            }
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-indigo-300 focus:ring"
          >
            <option value="">{language === "en" ? "Anyone available" : "Cualquiera disponible"}</option>
            {stylists
              .filter((stylist) => stylist.available !== false && (stylist.service_ids ?? []).includes(form.serviceId))
              .map((stylist) => (
              <option key={stylist.id} value={stylist.id}>
                {stylist.first_name} {stylist.last_name}
              </option>
            ))}
          </select>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">{t("appointments.payment")}</label>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setForm((current) => ({ ...current, paymentProvider: "cash" }))}
                className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                  form.paymentProvider === "cash"
                    ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
              >
                {t("appointments.cashLocal")}
              </button>
              <button
                type="button"
                onClick={() => setForm((current) => ({ ...current, paymentProvider: "wallet" }))}
                className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                  form.paymentProvider === "wallet"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
              >
                {t("appointments.walletBalance")}
              </button>
            </div>
            {form.paymentProvider === "wallet" ? (
              <p className="mt-2 text-xs text-slate-600">
                {wallet ? (language === "en" ? `Available balance: $${Number(wallet.balance).toFixed(2)}` : `Saldo disponible: $${Number(wallet.balance).toFixed(2)}`) : (language === "en" ? "We couldn't load your balance." : "No pudimos cargar tu saldo.")}
              </p>
            ) : (
              <p className="mt-2 text-xs text-slate-600">{language === "en" ? "You will pay directly at the salon when the appointment ends." : "Pagarás directamente en el local al finalizar la cita."}</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* Solo lectura: el precio es el del servicio y lo fija el servidor */}
            <p className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm text-slate-700" aria-live="polite">
              {!form.serviceId
                ? language === "en" ? "Select a service to see its price" : "Elige un servicio para ver su precio"
                : Number(form.totalAmount) === 0
                  ? language === "en" ? "Free of charge" : "Sin costo"
                  : `${language === "en" ? "Price" : "Precio"}: ${new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(form.totalAmount))}`}
            </p>
          </div>

          <textarea
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            rows={3}
            placeholder={language === "en" ? "Appointment notes (optional)" : "Notas de la cita (opcional)"}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none ring-indigo-300 focus:ring"
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-[#130b3a] px-5 text-sm font-semibold text-white transition hover:bg-[#231365] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? (language === "en" ? "Saving..." : "Guardando...") : (language === "en" ? "Schedule appointment" : "Agendar cita")}
          </button>
        </form>
      </article>

      <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{language === "en" ? "History" : "Historial"}</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-black text-[#151138]">{language === "en" ? "Your appointments" : "Tus citas"}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleClearPastHistory}
              disabled={isClearingPastHistory || isDeletingAllAppointments}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-amber-300 bg-amber-50 px-4 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isClearingPastHistory ? (language === "en" ? "Clearing..." : "Limpiando...") : (language === "en" ? "Clear past appointments only" : "Limpiar solo historial pasado")}
            </button>

            <button
              type="button"
              onClick={handleDeleteAllAppointments}
              disabled={isDeletingAllAppointments || isClearingPastHistory}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-rose-300 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isDeletingAllAppointments ? (language === "en" ? "Deleting all..." : "Borrando todo...") : (language === "en" ? "Delete all appointments" : "Borrar todas las citas")}
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {appointments.map((appointment) => (
            <div key={appointment.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-slate-800">
                  {appointment.service_name}
                  {appointment.stylist_first_name ? (
                    <span className="font-normal text-slate-500">
                      {" · "}
                      {language === "en" ? "with" : "con"} {appointment.stylist_first_name} {appointment.stylist_last_name ?? ""}
                    </span>
                  ) : null}
                </p>
                <span className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold uppercase ${colorEstado(appointment.status)}`}>
                  {etiquetaEstado(appointment.status, language)}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {(appointment.business_name || `${appointment.first_name ?? ""} ${appointment.last_name ?? ""}`.trim()) ||
                  (language === "en" ? "Business" : "Negocio")}
              </p>
              <p className="mt-1 text-sm text-slate-600">{fechaHoraCita(appointment.scheduled_at, language)}</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">${Number(appointment.total_amount).toFixed(2)}</p>

              {appointment.notes ? (
                <p className="mt-1 text-xs text-slate-500">{language === "en" ? "Notes:" : "Notas:"} {appointment.notes}</p>
              ) : null}

              {puedeModificarCliente(appointment) === "fuera-de-plazo" ? (
                <p className="mt-2 text-xs text-slate-500">
                  {language === "en"
                    ? "Less than 2 hours to go: to change it, contact the business."
                    : "Faltan menos de 2 horas: para cambiarla, comunícate con el negocio."}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                {puedeModificarCliente(appointment) === "permitido" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => openReschedule(appointment)}
                      disabled={cancellingAppointmentId === appointment.id}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-indigo-300 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {language === "en" ? "Reschedule" : "Reagendar"}
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleCancelAppointment(appointment.id)}
                      disabled={cancellingAppointmentId === appointment.id}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {cancellingAppointmentId === appointment.id ? (language === "en" ? "Cancelling..." : "Cancelando...") : (language === "en" ? "Cancel appointment" : "Cancelar cita")}
                    </button>
                  </>
                ) : null}

                <button
                  type="button"
                  onClick={() => void handleDeleteAppointment(appointment.id)}
                  disabled={deletingAppointmentId === appointment.id || cancellingAppointmentId === appointment.id}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-rose-300 bg-rose-50 px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingAppointmentId === appointment.id ? (language === "en" ? "Deleting..." : "Borrando...") : (language === "en" ? "Delete from history" : "Borrar del historial")}
                </button>
              </div>

              {editingAppointmentId === appointment.id ? (
                <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">{language === "en" ? "Reschedule appointment" : "Reagendar cita"}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <input
                      type="date"
                      value={editDate}
                      min={new Date().toISOString().split("T")[0]}
                      aria-label={language === "en" ? "New date" : "Nueva fecha"}
                      onChange={(event) => {
                        setEditDate(event.target.value);
                        setEditScheduledAt("");
                      }}
                      className="h-10 rounded-lg border border-indigo-200 bg-white px-3 text-sm outline-none ring-indigo-300 focus:ring"
                    />
                    <input
                      value={editNotes}
                      onChange={(event) => setEditNotes(event.target.value)}
                      placeholder={language === "en" ? "Notes (optional)" : "Notas (opcional)"}
                      className="h-10 rounded-lg border border-indigo-200 bg-white px-3 text-sm outline-none ring-indigo-300 focus:ring"
                    />
                  </div>
                  {editDate && appointment.service_id ? (
                    <div className="mt-2">
                      <TimeSlotPicker
                        key={`${appointment.id}-${editDate}`}
                        businessUserId={appointment.business_user_id}
                        serviceId={appointment.service_id}
                        branchId={appointment.branch_id}
                        selectedDate={editDate}
                        onSelectTime={(iso) => setEditScheduledAt(iso)}
                      />
                    </div>
                  ) : null}
                  {!appointment.service_id ? (
                    <p className="mt-2 text-xs text-rose-700">
                      {language === "en" ? "This appointment has no service linked; contact the salon to change it." : "Esta cita no tiene un servicio asociado; comunícate con el salón para cambiarla."}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-indigo-700">
                    {language === "en"
                      ? "You can reschedule or cancel up to 2 hours before the appointment."
                      : "Puedes reagendar o cancelar hasta 2 horas antes de la cita."}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleReschedule(appointment.id)}
                      disabled={isSavingEdit}
                      className="inline-flex h-9 items-center justify-center rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSavingEdit ? (language === "en" ? "Saving..." : "Guardando...") : (language === "en" ? "Save new date" : "Guardar nueva fecha")}
                    </button>
                    <button
                      type="button"
                      onClick={closeReschedule}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      {language === "en" ? "Cancel" : "Cancelar"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}

          {appointments.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
              {language === "en" ? "You don't have any appointments yet." : "No tienes citas registradas todavía."}
            </p>
          ) : null}
        </div>
      </article>
    </section>
  );
}
