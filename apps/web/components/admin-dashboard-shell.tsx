"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BarChart3, Bell, ChevronRight, LayoutDashboard, LifeBuoy, Menu, Settings2, ShieldCheck, Sparkles, X } from "lucide-react";
import { signOut, useSession } from "next-auth/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/toast";
import { cn } from "@/lib/utils";

type AdminDashboardShellProps = {
  children: ReactNode;
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  { href: "/dashboard/admin", label: "Resumen", icon: LayoutDashboard },
  { href: "/dashboard/admin#verificaciones", label: "Verificaciones", icon: ShieldCheck },
  { href: "/dashboard/admin#modulos", label: "Módulos", icon: Settings2 },
  { href: "/dashboard/admin#metricas", label: "Métricas", icon: BarChart3 },
  { href: "/dashboard/admin/soporte", label: "Soporte AURA", icon: LifeBuoy },
];

export default function AdminDashboardShell({ children }: AdminDashboardShellProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement | null>(null);
  const { showToast } = useToast();

  const activePath = useMemo(() => pathname, [pathname]);
  const authProvider = session?.user?.authProvider;
  const isGoogleLogin = authProvider === "google";
  const avatarImage = isGoogleLogin ? session?.user?.image : null;
  const userDisplayName = session?.user?.name || session?.user?.email || "Administrador";
  const userInitials = useMemo(() => {
    const base = session?.user?.name || session?.user?.email || "A";
    const parts = base.trim().split(/\s+/).filter(Boolean);

    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    return base.slice(0, 2).toUpperCase();
  }, [session?.user?.name, session?.user?.email]);

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

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[280px_1fr]">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-70 border-r border-slate-200 bg-white px-4 py-5 transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex h-full flex-col gap-4">
            <div className="flex items-center justify-between px-1">
              <Link href="/dashboard/admin" className="group inline-flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
                  <ShieldCheck className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-black tracking-wide text-slate-900">STYLEHUB</p>
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Admin Center</p>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 lg:hidden"
                aria-label="Cerrar menú"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-indigo-700">Estado global</p>
                <Badge variant="success">Operativo</Badge>
              </div>
              <p className="mt-1 text-xs text-indigo-700/80">Monitoreo y gobierno en tiempo real</p>
            </div>

            <Separator />

            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  (item.href === "/dashboard/admin" && activePath === "/dashboard/admin") ||
                  (item.href !== "/dashboard/admin" && activePath.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                      isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100",
                    )}
                  >
                    <Icon className={cn("size-4", isActive ? "text-white" : "text-slate-500")} />
                    <span>{item.label}</span>
                    <ChevronRight className={cn("ml-auto size-4", isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600")} />
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
                <Sparkles className="size-3.5 text-indigo-500" />
                Modo administrativo
              </p>
              <p className="mt-1 text-xs text-slate-500">Control total de seguridad, módulos y operaciones.</p>
            </div>
          </div>
        </aside>

        {sidebarOpen ? (
          <div
            role="presentation"
            className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <section className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur-sm sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
                  <Menu className="size-4" />
                </Button>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Administración</p>
                  <p className="text-sm font-bold text-slate-900">Panel oficial</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Bell className="size-4" />
                  Alertas
                </Button>
                <div className="relative" ref={avatarMenuRef}>
                  <button
                    type="button"
                    onClick={() => setAvatarMenuOpen((previous) => !previous)}
                    className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-white text-sm font-bold text-slate-900 shadow-sm transition hover:shadow-md"
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
                    <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl" role="menu">
                      <div className="border-b border-slate-200 px-3 py-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{userDisplayName}</p>
                        <p className="text-xs text-slate-500">{isGoogleLogin ? "Google" : "Correo y contraseña"}</p>
                      </div>

                      <Link
                        href="/"
                        onClick={() => setAvatarMenuOpen(false)}
                        className="mt-1 flex w-full items-center rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                        role="menuitem"
                      >
                        Ir al sitio
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
                        {loggingOut ? "Cerrando..." : "Cerrar sesión"}
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
                  Vas a salir del panel administrativo. ¿Deseas continuar?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  onClick={() => {
                    showToast({
                      type: "info",
                      title: "Acción cancelada",
                      message: "Seguiste con tu sesión activa.",
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

          <div className="px-4 py-5 sm:px-6">{children}</div>
        </section>
      </div>
    </main>
  );
}
