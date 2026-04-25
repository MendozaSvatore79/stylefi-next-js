"use client";

import { useEffect, useMemo, useState } from "react";

type ModuleStatus = "online" | "degraded" | "offline";

type LiveDashboardModule = {
  key: string;
  title: string;
  description: string;
  isMaintenance: boolean;
  status: ModuleStatus;
  primaryStat: string;
  secondaryStat: string;
};

type LiveDashboardPayload = {
  overallStatus: ModuleStatus;
  isMaintenanceMode: boolean;
  modules: LiveDashboardModule[];
  weeklyActivity: {
    bars: number[];
    trendLabel: string;
  };
};

const fallbackDashboard: LiveDashboardPayload = {
  overallStatus: "offline",
  isMaintenanceMode: false,
  modules: [],
  weeklyActivity: {
    bars: [8, 8, 8, 8, 8, 8, 8],
    trendLabel: "0% reservas",
  },
};

const statusStyles: Record<ModuleStatus, { label: string; badge: string; dot: string }> = {
  online: {
    label: "Online",
    badge: "border-emerald-300/30 bg-emerald-700/20 text-emerald-200",
    dot: "bg-emerald-400",
  },
  degraded: {
    label: "Degradado",
    badge: "border-amber-300/30 bg-amber-600/20 text-amber-100",
    dot: "bg-amber-400",
  },
  offline: {
    label: "Offline",
    badge: "border-red-300/30 bg-red-700/20 text-red-100",
    dot: "bg-red-400",
  },
};

export function LiveDashboardPanel() {
  const [dashboard, setDashboard] = useState<LiveDashboardPayload>(fallbackDashboard);

  useEffect(() => {
    const controller = new AbortController();

    const loadDashboard = async () => {
      try {
        const response = await fetch("/api/live-dashboard", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as LiveDashboardPayload;
        setDashboard(payload);
      } catch {
        setDashboard(fallbackDashboard);
      }
    };

    void loadDashboard();

    return () => controller.abort();
  }, []);

  const activeStatus = useMemo(() => statusStyles[dashboard.overallStatus], [dashboard.overallStatus]);
  const statusText = dashboard.isMaintenanceMode ? "Mantenimiento" : activeStatus.label;
  const statusBadgeClassName = dashboard.isMaintenanceMode
    ? "border-amber-300/30 bg-amber-600/20 text-amber-100"
    : activeStatus.badge;
  const activeModulesCount = dashboard.modules.length;
  const maintenanceModulesCount = dashboard.modules.filter((item) => item.isMaintenance).length;
  const onlineModulesCount = dashboard.modules.filter((item) => !item.isMaintenance && item.status === "online").length;

  return (
    <div className="relative overflow-hidden rounded-4xl border border-white/15 bg-[#10162f] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.45)] sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">Live dashboard</p>
          <p className="mt-1 text-xl font-black text-white">Panel inteligente</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClassName}`}>{statusText}</span>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between text-white">
          <span className="text-sm font-semibold">Stats en vivo</span>
          <span className="text-xs text-white/60">
            {onlineModulesCount}/{activeModulesCount} online · {maintenanceModulesCount} en mantenimiento
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {dashboard.modules.map((item, index) => (
            <article
              key={`${item.key}-stat`}
              className={`rounded-2xl border border-white/10 p-4 text-white ${index === 0 ? "bg-blue-700/35" : "bg-white/5"}`}
            >
              <p className="text-sm font-bold">{item.title}</p>
              <p className="mt-1 text-xs leading-5 text-white/70">{item.description}</p>
              <p className="mt-2 text-sm font-semibold text-white">{item.primaryStat}</p>
              <p className="text-xs text-white/60">{item.secondaryStat}</p>
            </article>
          ))}

          {dashboard.modules.length === 0 ? (
            <article className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white sm:col-span-2">
              <p className="text-sm font-semibold">{dashboard.isMaintenanceMode ? "Modo mantenimiento activo" : "No hay stats activos"}</p>
              <p className="mt-1 text-xs text-white/70">
                {dashboard.isMaintenanceMode
                  ? "Todos los módulos del live dashboard están desactivados o en mantenimiento desde admin."
                  : "Activa stats desde el panel admin para mostrarlos aquí."}
              </p>
            </article>
          ) : null}
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between text-white">
          <span className="text-sm font-semibold">Módulos oficiales</span>
          <span className="text-xs text-white/60">Estado por módulo</span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {dashboard.modules.map((item, index) => {
          const status = statusStyles[item.status];
          const moduleStatusText = item.isMaintenance ? "Mantenimiento" : status.label;
          const moduleStatusDotClass = item.isMaintenance ? "bg-amber-400" : status.dot;

          return (
            <article
              key={item.key}
              className={`rounded-2xl border border-white/10 p-4 text-white ${index === 0 ? "bg-blue-700/35" : "bg-white/5"} ${index % 2 === 0 ? "animate-float-slow" : "animate-drift"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold">{item.title}</p>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-white/70">
                  <span className={`h-2 w-2 rounded-full ${moduleStatusDotClass}`} />
                  {moduleStatusText}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-white/70">{item.description}</p>
            </article>
          );
        })}
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between text-white">
          <span className="text-sm font-semibold">Actividad semanal</span>
          <span className="text-xs text-white/60">{dashboard.weeklyActivity.trendLabel}</span>
        </div>
        <div className="mt-4 flex h-24 items-end gap-2">
          {dashboard.weeklyActivity.bars.map((height, index) => (
            <div key={index} className="flex-1 rounded-full bg-white/10">
              <div
                className={`w-full rounded-full ${index % 2 === 0 ? "bg-blue-600" : "bg-red-600"} shadow-[0_0_20px_rgba(59,130,246,0.20)] transition duration-500 hover:opacity-90`}
                style={{ height: `${height}%` }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
