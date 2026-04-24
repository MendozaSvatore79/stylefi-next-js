"use client";

import { useEffect, useMemo, useState } from "react";
import PlatformOnboardingModal from "@/components/platform-onboarding-modal";
import { useLanguage } from "@/lib/language-context";

type Appointment = {
  id: string;
  service_name: string;
  scheduled_at: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  total_amount: string;
};

type PaymentMethod = {
  id: string;
  provider: string;
  is_default: boolean;
};

export default function ClienteDashboardPage() {
  const { t } = useLanguage();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    void (async () => {
      const [appointmentsResponse, methodsResponse, onboardingResponse] = await Promise.all([
        fetch("/api/client/appointments", { cache: "no-store" }),
        fetch("/api/client/payment-methods", { cache: "no-store" }),
        fetch("/api/onboarding", { cache: "no-store" }),
      ]);

      if (appointmentsResponse.ok) {
        const payload = (await appointmentsResponse.json()) as { appointments: Appointment[] };
        setAppointments(payload.appointments ?? []);
      }

      if (methodsResponse.ok) {
        const payload = (await methodsResponse.json()) as { methods: PaymentMethod[] };
        setMethods(payload.methods ?? []);
      }

      if (onboardingResponse.ok) {
        const payload = (await onboardingResponse.json()) as { seen: boolean };
        setShowOnboarding(!payload.seen);
      }
    })();
  }, []);

  const closeOnboarding = async () => {
    try {
      await fetch("/api/onboarding", { method: "POST" });
    } catch (error) {
      console.error("No se pudo actualizar onboarding global", error);
    } finally {
      setShowOnboarding(false);
    }
  };

  const totals = useMemo(() => {
    const pending = appointments.filter((item) => item.status === "pending").length;
    const confirmed = appointments.filter((item) => item.status === "confirmed").length;
    const spent = appointments
      .filter((item) => item.status === "completed")
      .reduce((sum, item) => sum + Number(item.total_amount), 0);

    return {
      appointments: appointments.length,
      pending,
      confirmed,
      methods: methods.length,
      spent,
    };
  }, [appointments, methods]);

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-3xl font-black text-[#151138]">{t("dashboard.client.welcome")}</h2>
        <p className="mt-2 text-slate-600">{t("dashboard.client.subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard title={t("dashboard.client.totalAppointments")} value={String(totals.appointments)} tone="from-indigo-500 to-indigo-700" />
        <StatCard title={t("dashboard.client.pending")} value={String(totals.pending)} tone="from-amber-500 to-orange-600" />
        <StatCard title={t("dashboard.client.confirmed")} value={String(totals.confirmed)} tone="from-emerald-500 to-teal-600" />
        <StatCard title={t("dashboard.client.methods")} value={String(totals.methods)} tone="from-cyan-500 to-sky-600" />
        <StatCard title={t("dashboard.client.spent")} value={`$${totals.spent.toFixed(2)}`} tone="from-fuchsia-500 to-purple-700" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <article className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">{t("dashboard.client.upcoming")}</p>
                <h3 className="mt-1 text-2xl font-black text-[#151138]">{t("dashboard.client.agenda")}</h3>
              </div>
              <div className="text-3xl">📅</div>
            </div>

            <div className="mt-6 space-y-3">
              {appointments.slice(0, 5).map((appointment, index) => (
                <div
                  key={appointment.id}
                  className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-linear-to-r from-slate-50 to-transparent p-4 hover:border-indigo-300 hover:bg-indigo-50 transition-all"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-lg font-bold text-indigo-600">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800">{appointment.service_name}</p>
                    <p className="text-sm text-slate-500">{new Date(appointment.scheduled_at).toLocaleString("es-MX")}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                      appointment.status === "confirmed"
                        ? "bg-emerald-100 text-emerald-800"
                        : appointment.status === "pending"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-800"
                    }`}
                  >
                    {appointment.status}
                  </span>
                </div>
              ))}

              {appointments.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
                  <p className="text-2xl">📭</p>
                  <p className="mt-2 font-semibold text-slate-700">{t("dashboard.client.noUpcoming")}</p>
                  <p className="mt-1 text-sm text-slate-600">{t("dashboard.client.noUpcomingDesc")}</p>
                </div>
              ) : null}
            </div>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">{t("dashboard.client.activity")}</p>
                <h3 className="mt-1 text-2xl font-black text-[#151138]">{t("dashboard.client.latest")}</h3>
              </div>
              <div className="text-3xl">✨</div>
            </div>

            <div className="mt-6 space-y-3">
              {appointments.slice(0, 3).map((appointment) => (
                <div key={appointment.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="flex justify-between items-center">
                    <p className="font-semibold text-slate-800">{appointment.service_name}</p>
                    <p className="font-bold text-indigo-600">${Number(appointment.total_amount).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="space-y-6">
          <article className="rounded-3xl bg-linear-to-br from-indigo-600 to-purple-700 p-8 text-white shadow-lg">
            <p className="text-sm font-semibold uppercase tracking-wider opacity-90">{t("dashboard.client.activeMethod")}</p>
            <h3 className="mt-2 text-xl font-black">{t("dashboard.client.fastPay")}</h3>

            {methods.find((item) => item.is_default) ? (
              <div className="mt-6 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm p-4">
                  <p className="text-sm opacity-90">{t("dashboard.client.methodType")}</p>
                <p className="mt-2 text-lg font-bold uppercase">
                  {methods.find((item) => item.is_default)?.provider}
                </p>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl bg-white/10 border-2 border-dashed border-white/40 p-6 text-center">
                  <p className="text-sm">{t("dashboard.client.noMethod")}</p>
              </div>
            )}
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">{t("dashboard.client.savedMethods")}</p>
            <h3 className="mt-2 text-3xl font-black text-[#151138]">{totals.methods}</h3>
            <p className="mt-3 text-sm text-slate-600">{totals.methods > 0 ? t("dashboard.client.methodsActive") : t("dashboard.client.noMethodDesc")}</p>
          </article>

          <article className="rounded-3xl border-2 border-dashed border-indigo-300 bg-indigo-50 p-6">
            <p className="text-sm font-bold text-indigo-900">🎯 {t("dashboard.client.steps")}</p>
            <ul className="mt-3 space-y-2 text-sm text-indigo-800">
              <li>✓ {t("dashboard.client.step1")}</li>
              <li>✓ {t("dashboard.client.step2")}</li>
              <li>✓ {t("dashboard.client.step3")}</li>
            </ul>
          </article>
        </div>
      </div>

      {showOnboarding ? <PlatformOnboardingModal accountType="cliente" onClose={() => void closeOnboarding()} /> : null}
    </section>
  );
}

function StatCard({ title, value, tone }: { title: string; value: string; tone: string }) {
  return (
    <article className={`rounded-2xl bg-linear-to-br ${tone} p-px shadow-lg`}>
      <div className="rounded-2xl bg-white/95 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</p>
        <p className="mt-2 text-2xl font-black text-[#151138]">{value}</p>
      </div>
    </article>
  );
}
