"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import { useLanguage } from "@/lib/language-context";

type MenuItem = {
  href: string;
  labelKey: string;
  icon: string;
};

const MENU_ITEMS: MenuItem[] = [
  { href: "/dashboard/cliente", labelKey: "nav.dashboard.client", icon: "📊" },
  { href: "/dashboard/cliente/salones", labelKey: "nav.salons", icon: "💇" },
  { href: "/dashboard/cliente/citas", labelKey: "nav.appointments", icon: "📅" },
  { href: "/dashboard/cliente/pagos", labelKey: "nav.payments", icon: "💳" },
  { href: "/dashboard/cliente/configuracion", labelKey: "nav.settings", icon: "⚙️" },
];

export default function ClientDashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { t } = useLanguage();

  const activeItem = useMemo(
    () => MENU_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) ?? MENU_ITEMS[0],
    [pathname],
  );

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 text-slate-900">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[300px_1fr]">
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-[300px] transform border-r border-slate-200 bg-gradient-to-b from-white via-white to-slate-50 backdrop-blur-xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex flex-col h-full">
            <div className="border-b border-slate-200 px-6 py-8">
              <Link href="/" className="flex items-center gap-2 group">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-indigo-600 to-purple-600 text-lg font-bold text-white group-hover:shadow-lg group-hover:shadow-indigo-600/40 transition-shadow">
                  S
                </div>
                <div>
                  <p className="text-sm font-black text-[#171135]">{t("app.brand")}</p>
                  <p className="text-xs text-slate-500">{t("app.subtitle.client")}</p>
                </div>
              </Link>
            </div>

            <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto">
              {MENU_ITEMS.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                      active
                        ? "bg-linear-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30"
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
              <div className="rounded-2xl bg-linear-to-br from-indigo-50 to-purple-50 border border-indigo-200 p-4 text-sm">
                <p className="font-bold text-indigo-900">💡 {t("tip.client.title")}</p>
                <p className="mt-2 text-indigo-800">{t("tip.client.body")}</p>
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
                  <h1 className="text-xl font-black text-[#151138]">{t(activeItem.labelKey)}</h1>
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
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  {t("nav.logout")}
                </Link>
              </div>
            </div>
          </header>

          <section className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-8 max-w-350 w-full mx-auto">
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}
