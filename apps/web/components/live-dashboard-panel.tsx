"use client";

import { useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";

type ModuleStatus = "online" | "degraded" | "offline";

type LiveDashboardModule = {
  key: string;
  title: string;
  description: string;
  isMaintenance: boolean;
  status: ModuleStatus;
};

/**
 * Versión pública del panel (decisión de producto): solo si cada módulo está en línea o en mantenimiento, sin
 * cifras del negocio ni actividad semanal. Las cifras quedan para el panel del admin.
 */
type LiveDashboardPayload = {
  overallStatus: ModuleStatus;
  isMaintenanceMode: boolean;
  modules: LiveDashboardModule[];
};

const fallbackDashboard: LiveDashboardPayload = {
  overallStatus: "offline",
  isMaintenanceMode: false,
  modules: [],
};

const etiquetaDeModulo = (module: LiveDashboardModule) =>
  module.isMaintenance
    ? { texto: "En mantenimiento", clase: "border-amber-300/30 bg-amber-600/20 text-amber-100" }
    : { texto: "En línea", clase: "border-emerald-300/30 bg-emerald-700/20 text-emerald-200" };

const statusStyles: Record<ModuleStatus, { label: string; badge: string }> = {
  online: {
    label: "Online",
    badge: "border-emerald-300/30 bg-emerald-700/20 text-emerald-200",
  },
  degraded: {
    label: "Desactivado",
    badge: "border-amber-300/30 bg-amber-600/20 text-amber-100",
  },
  offline: {
    label: "Offline",
    badge: "border-red-300/30 bg-red-700/20 text-red-100",
  },
};

/**
 * Los 4 módulos que caben en la portada. Decisión de producto: los que están en mantenimiento van primero, para que
 * siempre se vean (antes quedaban al final y fuera de los 4; solo los contaba el contador). El resto conserva su orden.
 */
export function modulosDeLaPortada<T extends { isMaintenance: boolean }>(modulos: T[]): T[] {
  return [...modulos].sort((a, b) => Number(b.isMaintenance) - Number(a.isMaintenance)).slice(0, 4);
}

export function LiveDashboardPanel() {
  const [dashboard, setDashboard] = useState<LiveDashboardPayload>(fallbackDashboard);

  useEffect(() => {
    const controller = new AbortController();

    const loadDashboard = async () => {
      try {
        const response = await api("/api/live-dashboard", {
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
  const statsModules = modulosDeLaPortada(dashboard.modules);

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
          <span className="text-sm font-semibold">Estado de los módulos</span>
          <span className="text-xs text-white/60">
            {onlineModulesCount}/{activeModulesCount} online · {maintenanceModulesCount} en mantenimiento
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {statsModules.map((item, index) => (
            <article
              key={`${item.key}-stat`}
              className={`rounded-2xl border border-white/10 p-4 text-white ${index === 0 ? "bg-blue-700/35" : "bg-white/5"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold">{item.title}</p>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${etiquetaDeModulo(item).clase}`}>
                  {etiquetaDeModulo(item).texto}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-white/70">{item.description}</p>
            </article>
          ))}

          {statsModules.length === 0 ? (
            <article className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white sm:col-span-2">
              <p className="text-sm font-semibold">{dashboard.isMaintenanceMode ? "Modo mantenimiento activo" : "No hay módulos activos"}</p>
              <p className="mt-1 text-xs text-white/70">
                {dashboard.isMaintenanceMode
                  ? "Todos los módulos del live dashboard están desactivados o en mantenimiento desde admin."
                  : "Activa módulos desde el panel admin para mostrarlos aquí."}
              </p>
            </article>
          ) : null}
        </div>
      </div>

    </div>
  );
}
