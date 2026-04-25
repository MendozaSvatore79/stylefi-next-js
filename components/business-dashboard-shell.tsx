"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { useLanguage } from "@/lib/language-context";

type MenuItem = {
  href: string;
  labelKey: string;
  icon: string;
};

type ModuleAccessResponse = {
  module: {
    key: string;
    title: string;
    isEnabled: boolean;
    isMaintenance: boolean;
  } | null;
  blocked: boolean;
  reason: "disabled" | "maintenance" | null;
};

const MENU_ITEMS: MenuItem[] = [
  { href: "/dashboard/negocio", labelKey: "nav.dashboard.business", icon: "📈" },
  { href: "/dashboard/negocio/sucursales", labelKey: "nav.branches", icon: "🏬" },
  { href: "/dashboard/negocio/servicios", labelKey: "nav.services", icon: "✂️" },
  { href: "/dashboard/negocio/estilistas", labelKey: "nav.stylists", icon: "🧑‍🎨" },
  { href: "/dashboard/negocio/citas", labelKey: "nav.appointments", icon: "📅" },
  { href: "/dashboard/negocio/configuracion", labelKey: "nav.profile", icon: "🏪" },
];

export default function BusinessDashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moduleAccess, setModuleAccess] = useState<ModuleAccessResponse | null>(null);
  const { t } = useLanguage();

  const activeItem = useMemo(
    () => MENU_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) ?? MENU_ITEMS[0],
    [pathname],
  );

  useEffect(() => {
    const controller = new AbortController();

    const loadModuleAccess = async () => {
      try {
        const response = await fetch(`/api/live-dashboard/module-access?pathname=${encodeURIComponent(pathname)}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as ModuleAccessResponse;
        setModuleAccess(payload);
      } catch {
        setModuleAccess(null);
      }
    };

    void loadModuleAccess();

    return () => controller.abort();
  }, [pathname]);

  const isBlocked = moduleAccess?.blocked ?? false;

  return (
    <main className="min-h-screen bg-linear-to-br from-slate-50 via-slate-100 to-slate-50 text-slate-900">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[300px_1fr]">
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-75 transform border-r border-slate-200 bg-linear-to-b from-white via-white to-slate-50 backdrop-blur-xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="border-b border-slate-200 px-6 py-8">
              <Link href="/" className="group flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-emerald-600 to-teal-600 text-lg font-bold text-white transition-shadow group-hover:shadow-lg group-hover:shadow-emerald-600/40">
                  B
                </div>
                <div>
                  <p className="text-sm font-black text-[#171135]">{t("app.brand")}</p>
                  <p className="text-xs text-slate-500">{t("app.subtitle.business")}</p>
                </div>
              </Link>
            </div>

            <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-6">
              {MENU_ITEMS.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                      active
                        ? "bg-linear-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/30"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span className={`text-lg transition-transform duration-200 ${active ? "scale-110" : "group-hover:scale-105"}`}>
                      {item.icon}
                    </span>
                    <span>{t(item.labelKey)}</span>
                    {active ? <span className="ml-auto text-lg">→</span> : null}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-slate-200 px-3 py-4">
              <div className="rounded-2xl border border-emerald-200 bg-linear-to-br from-emerald-50 to-teal-50 p-4 text-sm">
                <p className="font-bold text-emerald-900">🚀 {t("tip.business.title")}</p>
                <p className="mt-2 text-emerald-800">{t("tip.business.body")}</p>
              </div>
            </div>
          </div>
        </aside>

        {sidebarOpen ? (
          <div
            className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
            role="presentation"
          />
        ) : null}

        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-lg transition hover:bg-slate-50 lg:hidden"
                  aria-label="Abrir menú"
                >
                  ☰
                </button>
                <div className="hidden sm:block">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("nav.dashboard")}</p>
                  <h1 className="text-xl font-black text-[#151135]">{t(activeItem.labelKey)}</h1>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/"
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  {t("nav.home")}
                </Link>
                <Link
                  href="/iniciar-sesion"
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  {t("nav.logout")}
                </Link>
              </div>
            </div>
          </header>

          <section className="relative mx-auto w-full max-w-350 flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-8">
            {isBlocked ? (
              <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/90 px-6 backdrop-blur-sm">
                <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Estado del módulo</p>
                  <h2 className="mt-2 text-3xl font-black text-[#151138]">{moduleAccess?.module?.title || "Módulo"}</h2>
                  <p className="mt-4 text-sm text-slate-600">
                    {moduleAccess?.reason === "maintenance"
                      ? "Este módulo está temporalmente en mantenimiento."
                      : "Este módulo está desactivado por administración."}
                  </p>
                </div>
              </div>
            ) : null}
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}
