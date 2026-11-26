"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PlatformOnboardingModal from "@/components/platform-onboarding-modal";
import { useLanguage } from "@/lib/language-context";
import { api } from "@/lib/api";
import { avisoCitasPorCerrar } from "@/lib/citas-por-cerrar";

type Summary = {
  services: number;
  stylists: number;
  upcomingAppointments: number;
  monthlyRevenue: number;
  clients: number;
  branches: number;
  /** Sin ninguna aprobada el negocio no aparece en el catálogo. */
  approvedBranches: number;
  /** Ya pasaron (hace 7 días o menos) y siguen abiertas; un backend anterior no lo manda. */
  citasPorCerrar?: number;
};

export default function NegocioDashboardPage() {
  const { t, language } = useLanguage();
  const [cargado, setCargado] = useState(false);
  const [summary, setSummary] = useState<Summary>({
    services: 0,
    stylists: 0,
    upcomingAppointments: 0,
    monthlyRevenue: 0,
    clients: 0,
    branches: 0,
    approvedBranches: 0,
  });
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    void (async () => {
      const [summaryResponse, onboardingResponse] = await Promise.all([
        api("/api/business/summary", { cache: "no-store" }),
        api("/api/onboarding", { cache: "no-store" }),
      ]);

      if (summaryResponse.ok) {
        const payload = (await summaryResponse.json()) as { summary: Summary };
        setSummary(payload.summary);
        setCargado(true);
      }

      if (onboardingResponse.ok) {
        const payload = (await onboardingResponse.json()) as { seen: boolean };
        setShowOnboarding(!payload.seen);
      }
    })();
  }, []);

  const closeOnboarding = async () => {
    try {
      await api("/api/onboarding", { method: "POST" });
    } catch (error) {
      console.error("No se pudo actualizar onboarding global", error);
    } finally {
      setShowOnboarding(false);
    }
  };

  const metrics = useMemo(
    () => [
      { labelKey: "dashboard.business.services", value: String(summary.services), tone: "from-emerald-500 to-teal-600" },
      { labelKey: "dashboard.business.stylists", value: String(summary.stylists), tone: "from-cyan-500 to-sky-600" },
      {
        labelKey: "dashboard.business.branches",
        value: String(summary.branches),
        // Cuántas ve el cliente: solo las aprobadas aparecen en el catálogo
        detalle: language === "en" ? `${summary.approvedBranches} approved` : `${summary.approvedBranches} aprobada${summary.approvedBranches === 1 ? "" : "s"}`,
        tone: "from-violet-500 to-fuchsia-600",
      },
      { labelKey: "dashboard.business.upcoming", value: String(summary.upcomingAppointments), tone: "from-indigo-500 to-purple-600" },
      { labelKey: "dashboard.business.clients", value: String(summary.clients), tone: "from-amber-500 to-orange-600" },
      { labelKey: "dashboard.business.revenueMonth", value: `$${summary.monthlyRevenue.toFixed(2)}`, tone: "from-fuchsia-500 to-pink-600" },
    ],
    [summary, language],
  );

  const avisoPorCerrar = cargado ? avisoCitasPorCerrar(summary.citasPorCerrar ?? 0, language === "en" ? "en" : "es") : null;

  return (
    <section className="space-y-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{t("dashboard.business.summary")}</p>
        <h2 className="mt-2 text-3xl font-black text-[#151138]">{t("dashboard.business.title")}</h2>
        <p className="mt-2 text-slate-600">{t("dashboard.business.subtitle")}</p>
      </div>

      {avisoPorCerrar ? (
        <div role="status" data-aviso-por-cerrar className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <p>
            {avisoPorCerrar}{" "}
            <Link href="/dashboard/negocio/citas" className="font-semibold underline">
              {language === "en" ? "Go to Appointments" : "Ir a Citas"}
            </Link>
          </p>
        </div>
      ) : null}

      {cargado && summary.approvedBranches === 0 ? (
        <div role="status" data-aviso-visibilidad className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <p className="font-semibold">
            {language === "en" ? "Your business is not visible in the catalog yet." : "Tu negocio todavía no aparece en el catálogo."}
          </p>
          <p className="mt-1">
            {summary.branches === 0
              ? language === "en"
                ? "Register your first branch; it will appear once the administration approves it."
                : "Registra tu primera sucursal; aparecerá cuando la administración la apruebe."
              : language === "en"
                ? "It will appear once the administration approves one of your branches."
                : "Aparecerá cuando la administración apruebe alguna de tus sucursales."}{" "}
            <Link href="/dashboard/negocio/sucursales" className="font-semibold underline">
              {language === "en" ? "Go to Branches" : "Ir a Sucursales"}
            </Link>
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map((item) => (
          <article key={item.labelKey} className={`rounded-2xl bg-linear-to-br ${item.tone} p-px shadow-lg`}>
            <div className="rounded-2xl bg-white/95 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{t(item.labelKey)}</p>
              <p className="mt-2 text-2xl font-black text-[#151138]">{item.value}</p>
              {"detalle" in item && item.detalle ? <p className="mt-1 text-xs font-medium text-slate-500">{item.detalle}</p> : null}
            </div>
          </article>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">{t("dashboard.business.quickActions")}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link href="/dashboard/negocio/servicios" className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-200">
              {t("dashboard.business.manageServices")}
            </Link>
            <Link href="/dashboard/negocio/estilistas" className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-200">
              {t("dashboard.business.manageStylists")}
            </Link>
            <Link href="/dashboard/negocio/citas" className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-200">
              {t("dashboard.business.reviewAppointments")}
            </Link>
            <Link href="/dashboard/negocio/sucursales" className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-200">
              {t("dashboard.business.manageBranches")}
            </Link>
            <Link href="/dashboard/negocio/configuracion" className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-200">
              {t("dashboard.business.configureSalon")}
            </Link>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-linear-to-br from-emerald-600 to-teal-700 p-6 text-white shadow-lg">
          <p className="text-sm font-semibold uppercase tracking-wider opacity-90">{t("dashboard.business.monthlyPerformance")}</p>
          <h3 className="mt-2 text-2xl font-black">${summary.monthlyRevenue.toFixed(2)}</h3>
          <p className="mt-2 text-sm opacity-90">{t("dashboard.business.revenue")}</p>
        </article>
      </div>

      {showOnboarding ? <PlatformOnboardingModal accountType="negocio" onClose={() => void closeOnboarding()} /> : null}
    </section>
  );
}
