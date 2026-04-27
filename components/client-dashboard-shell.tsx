"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { signOut, useSession } from "next-auth/react";
import { CalendarCheck2, ChevronRight, LayoutDashboard, Lightbulb, Menu, Settings2, Store, WalletCards, type LucideIcon } from "lucide-react";


import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/toast";
import { useLanguage } from "@/lib/language-context";

type MenuItem = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
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
  { href: "/dashboard/cliente", labelKey: "nav.dashboard.client", icon: LayoutDashboard },
  { href: "/dashboard/cliente/salones", labelKey: "nav.salons", icon: Store },
  { href: "/dashboard/cliente/citas", labelKey: "nav.appointments", icon: CalendarCheck2 },
  { href: "/dashboard/cliente/pagos", labelKey: "nav.payments", icon: WalletCards },
  { href: "/dashboard/cliente/configuracion", labelKey: "nav.settings", icon: Settings2 },
];

export default function ClientDashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moduleAccess, setModuleAccess] = useState<ModuleAccessResponse | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement | null>(null);
  const { t } = useLanguage();
  const { showToast } = useToast();

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

  useEffect(() => {
    setAvatarMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!avatarMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!avatarMenuRef.current) {
        return;
      }

      const target = event.target as Node;
      if (!avatarMenuRef.current.contains(target)) {
        setAvatarMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAvatarMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [avatarMenuOpen]);

  const authProvider = session?.user?.authProvider;
  const isGoogleLogin = authProvider === "google";
  const avatarImage = isGoogleLogin ? session?.user?.image : null;
  const userDisplayName = session?.user?.name || session?.user?.email || "Usuario";
  const userInitials = useMemo(() => {
    const base = session?.user?.name || session?.user?.email || "U";
    const parts = base.trim().split(/\s+/).filter(Boolean);

    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    return base.slice(0, 2).toUpperCase();
  }, [session?.user?.name, session?.user?.email]);

  const isBlocked = moduleAccess?.blocked ?? false;

  return (
    <main className="min-h-screen bg-linear-to-br from-[#eef2ff] via-[#f3f4f6] to-[#eef2ff] text-slate-900">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[300px_1fr]">
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-75 transform border-r border-blue-950/10 bg-linear-to-b from-white via-white to-[#eef2ff] backdrop-blur-xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex flex-col h-full">
            <div className="border-b border-slate-200 px-6 py-8">
              <Link href="/" className="flex items-center gap-2 group">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-[#0d1b3d] to-blue-700 text-lg font-bold text-white transition-shadow group-hover:shadow-lg group-hover:shadow-blue-600/35">
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
                const ItemIcon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                      active
                        ? "bg-linear-to-r from-[#0d1b3d] to-blue-700 text-white shadow-lg shadow-blue-700/25"
                        : "text-slate-700 hover:bg-blue-50"
                    }`}
                  >
                    <ItemIcon className={`size-5 transition-transform duration-200 ${active ? "scale-110 text-white" : "text-slate-500 group-hover:scale-105 group-hover:text-[#0d1b3d]"}`} />
                    <span>{t(item.labelKey)}</span>
                    {active ? <ChevronRight className="ml-auto size-4 text-white" /> : null}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-slate-200 px-3 py-4">
              <div className="rounded-2xl border border-blue-200 bg-linear-to-br from-blue-50 to-red-50 p-4 text-sm">
                <p className="flex items-center gap-1 font-bold text-[#0d1b3d]"><Lightbulb className="size-4" /> {t("tip.client.title")}</p>
                <p className="mt-2 text-slate-700">{t("tip.client.body")}</p>
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
          <header className="sticky top-0 z-20 border-b border-blue-950/10 bg-white/85 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-lg transition hover:bg-slate-50 lg:hidden"
                  aria-label="Abrir menú"
                >
                  <Menu className="size-5" />
                </button>
                <div className="hidden sm:block">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("nav.dashboard")}</p>
                  <h1 className="text-xl font-black text-[#151138]">{t(activeItem.labelKey)}</h1>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative" ref={avatarMenuRef}>
                  <button
                    type="button"
                    onClick={() => setAvatarMenuOpen((previous) => !previous)}
                    className="inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-blue-950/15 bg-white text-sm font-bold text-[#0d1b3d] shadow-sm transition hover:shadow-md"
                    aria-label="Abrir menú de usuario"
                    aria-haspopup="menu"
                    aria-expanded={avatarMenuOpen}
                  >
                    {avatarImage ? (
                      <span
                        className="h-full w-full bg-cover bg-center"
                        aria-label={userDisplayName}
                        style={{ backgroundImage: `url(${avatarImage})` }}
                      />
                    ) : (
                      <span>{userInitials}</span>
                    )}
                  </button>

                  {avatarMenuOpen ? (
                    <div className="absolute right-0 top-13 z-50 w-56 rounded-2xl border border-blue-950/10 bg-white p-2 shadow-xl" role="menu">
                      <div className="border-b border-slate-200 px-3 py-2">
                        <p className="truncate text-sm font-semibold text-[#151138]">{userDisplayName}</p>
                        <p className="text-xs text-slate-500">{isGoogleLogin ? "Google" : "Correo y contraseña"}</p>
                      </div>

                      <Link
                        href="/"
                        onClick={() => setAvatarMenuOpen(false)}
                        className="mt-1 flex w-full items-center rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-blue-50"
                        role="menuitem"
                      >
                        {t("nav.home")}
                      </Link>
                      <button
                        type="button"
                        disabled={loggingOut}
                        onClick={() => {
                          setAvatarMenuOpen(false);
                          setLogoutDialogOpen(true);
                        }}
                        className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
                        role="menuitem"
                      >
                        {loggingOut ? "Cerrando..." : t("nav.logout")}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </header>

          <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
                <AlertDialogDescription>
                  Vas a salir del dashboard de cliente. ¿Deseas continuar?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  onClick={() => {
                    showToast({
                      type: "info",
                      title: "Acción cancelada",
                      message: "Tu sesión sigue activa.",
                    });
                  }}
                >
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={loggingOut}
                  onClick={async () => {
                    try {
                      setLoggingOut(true);
                      showToast({
                        type: "success",
                        title: "Cerrando sesión",
                        message: "Redirigiendo al inicio de sesión...",
                      });
                      await signOut({ callbackUrl: "/iniciar-sesion" });
                    } finally {
                      setLoggingOut(false);
                    }
                  }}
                >
                  {loggingOut ? "Cerrando..." : "Sí, cerrar sesión"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <section className="relative flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-8 max-w-350 w-full mx-auto">
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
