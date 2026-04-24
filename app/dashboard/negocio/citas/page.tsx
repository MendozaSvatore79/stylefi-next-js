"use client";

import { useEffect, useState } from "react";

import { useToast } from "@/components/toast";
import { useLanguage } from "@/lib/language-context";

type Appointment = {
  id: string;
  service_name: string;
  scheduled_at: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  total_amount: string;
  notes: string | null;
  first_name: string;
  last_name: string;
  email: string;
};

const STATUSES: Array<Appointment["status"]> = ["pending", "confirmed", "completed", "cancelled"];

export default function NegocioCitasPage() {
  const { showToast } = useToast();
  const { language } = useLanguage();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingStatusId, setLoadingStatusId] = useState<string | null>(null);
  const [savedStatusId, setSavedStatusId] = useState<string | null>(null);

  const loadAppointments = async () => {
    const response = await fetch("/api/business/appointments", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { appointments: Appointment[] };
    setAppointments(payload.appointments ?? []);
  };

  useEffect(() => {
    void loadAppointments();
  }, []);

  const updateStatus = async (appointmentId: string, status: Appointment["status"]) => {
    const previousAppointments = appointments;

    try {
      setLoadingStatusId(appointmentId);
      setAppointments((current) =>
        current.map((appointment) =>
          appointment.id === appointmentId
            ? {
                ...appointment,
                status,
              }
            : appointment,
        ),
      );

      const response = await fetch("/api/business/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId, status }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? (language === "en" ? "Could not update status." : "No se pudo actualizar el estado."));
      }

      showToast({
        type: "success",
        title: language === "en" ? "Status updated" : "Estado actualizado",
      });

      setSavedStatusId(appointmentId);
      window.setTimeout(() => {
        setSavedStatusId((current) => (current === appointmentId ? null : current));
      }, 1800);

      void loadAppointments();
    } catch (error) {
      setAppointments(previousAppointments);
      showToast({
        type: "error",
        title: language === "en" ? "Error updating status" : "Error actualizando estado",
        message: error instanceof Error ? error.message : (language === "en" ? "Try again" : "Intenta de nuevo"),
      });
    } finally {
      setLoadingStatusId(null);
    }
  };

  return (
    <section className="space-y-6">
      <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{language === "en" ? "Schedule" : "Agenda"}</p>
        <h2 className="mt-2 text-2xl font-black text-[#151138]">{language === "en" ? "Appointment management" : "Gestión de citas"}</h2>

        <div className="mt-5 space-y-3">
          {appointments.map((appointment) => (
            <div key={appointment.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-800">{appointment.service_name}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {language === "en" ? "Client:" : "Cliente:"} {appointment.first_name} {appointment.last_name}
                  </p>
                  <p className="text-sm text-slate-600">{appointment.email}</p>
                  <p className="mt-1 text-sm text-slate-600">{new Date(appointment.scheduled_at).toLocaleString(language === "en" ? "en-US" : "es-MX")}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">${Number(appointment.total_amount).toFixed(2)}</p>
                </div>

                <div className="min-w-48">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{language === "en" ? "Status" : "Estado"}</label>
                  <select
                    value={appointment.status}
                    onChange={(event) => void updateStatus(appointment.id, event.target.value as Appointment["status"])}
                    disabled={loadingStatusId === appointment.id}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-emerald-300 focus:ring"
                  >
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status === "pending"
                          ? language === "en"
                            ? "Pending"
                            : "Pendiente"
                          : status === "confirmed"
                            ? language === "en"
                              ? "Confirmed"
                              : "Confirmada"
                            : status === "completed"
                              ? language === "en"
                                ? "Completed"
                                : "Completada"
                              : language === "en"
                                ? "Cancelled"
                                : "Cancelada"}
                      </option>
                    ))}
                  </select>

                  {loadingStatusId === appointment.id ? (
                    <p className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-emerald-700">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                      {language === "en" ? "Syncing changes..." : "Sincronizando cambios..."}
                    </p>
                  ) : null}

                  {savedStatusId === appointment.id ? (
                    <p className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-emerald-700">
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-[10px] text-emerald-700">
                        ✓
                      </span>
                      {language === "en" ? "Saved successfully" : "Guardado exitoso"}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ))}

          {appointments.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
              {language === "en" ? "You don't have appointments yet." : "Aún no tienes citas registradas."}
            </p>
          ) : null}
        </div>
      </article>
    </section>
  );
}
