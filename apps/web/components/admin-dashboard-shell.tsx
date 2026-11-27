"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Building2, CalendarClock, ChevronRight, ClipboardList, LayoutDashboard, LifeBuoy, Menu, Settings2, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import { useCerrarSesion, useSesion } from "@/lib/sesion-cliente";

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
import { useLanguage } from "@/lib/language-context";
import { pestanaAdmin, rutaDePestana, type PestanaAdmin } from "@/lib/pestanas-admin";
import { rutaActiva } from "@/lib/ruta-activa";

type AdminDashboardShellProps = {
  children: ReactNode;
};

type Texto = { es: string; en: string };

type NavItem = {
  href: string;
  label: Texto;
  icon: React.ComponentType<{ className?: string }>;
  /** Pestaña de la página principal que abre; sin ella, el elemento es una ruta propia (Negocios, Citas, Soporte). */
  pestana?: PestanaAdmin;
};

const deLaPestana = (pestana: PestanaAdmin, label: Texto, icon: NavItem["icon"]): NavItem => ({
  href: rutaDePestana(pestana),
  label,
  icon,
  pestana,
});

const navItems: NavItem[] = [
  deLaPestana("resumen", { es: "Resumen", en: "Overview" }, LayoutDashboard),
  deLaPestana("verificaciones", { es: "Verificaciones", en: "Verifications" }, ShieldCheck),
  { href: "/dashboard/admin/negocios", label: { es: "Negocios", en: "Businesses" }, icon: Building2 },
  { href: "/dashboard/admin/citas", label: { es: "Citas", en: "Appointments" }, icon: CalendarClock },
  deLaPestana("modulos", { es: "Módulos", en: "Modules" }, Settings2),
  deLaPestana("usuarios", { es: "Usuarios", en: "Users" }, Users),
  deLaPestana("auditoria", { es: "Auditoría", en: "Audit log" }, ClipboardList),
  { href: "/dashboard/admin/soporte", label: { es: "Soporte AURA", en: "AURA support" }, icon: LifeBuoy },
];

const TEXTOS = {
  centro: { es: "Centro de administración", en: "Admin Center" },
  cerrarMenu: { es: "Cerrar menú", en: "Close menu" },
  abrirMenu: { es: "Abrir menú", en: "Open menu" },
  modoAdmin: { es: "Modo administrativo", en: "Admin mode" },
  controlTotal: { es: "Control total de seguridad, módulos y operaciones.", en: "Full control of security, modules and operations." },
  administracion: { es: "Administración", en: "Administration" },
  panelOficial: { es: "Panel oficial", en: "Official panel" },
  menuUsuario: { es: "Abrir menú de usuario", en: "Open user menu" },
  administrador: { es: "Administrador", en: "Administrator" },
  correoYContrasena: { es: "Correo y contraseña", en: "Email and password" },
  irAlSitio: { es: "Ir al sitio", en: "Go to site" },
  cerrando: { es: "Cerrando...", en: "Signing out..." },
  cerrarSesion: { es: "Cerrar sesión", en: "Sign out" },
  preguntaCerrar: { es: "¿Cerrar sesión?", en: "Sign out?" },
  avisoCerrar: {
    es: "Vas a salir del panel administrativo. ¿Deseas continuar?",
    en: "You are about to leave the admin panel. Do you want to continue?",
  },
  cancelar: { es: "Cancelar", en: "Cancel" },
  accionCancelada: { es: "Acción cancelada", en: "Action cancelled" },
  seguisteConSesion: { es: "Seguiste con tu sesión activa.", en: "Your session is still active." },
  cerrandoSesion: { es: "Cerrando sesión", en: "Signing out" },
  redirigiendo: { es: "Redirigiendo al inicio de sesión...", en: "Redirecting to sign in..." },
  siCerrar: { es: "Sí, cerrar sesión", en: "Yes, sign out" },
} satisfies Record<string, Texto>;

export default function AdminDashboardShell({ children }: AdminDashboardShellProps) {
  const pathname = usePathname();
  const pestanaActual = pestanaAdmin(useSearchParams().get("pestana"));
  const { language } = useLanguage();
  const { data: session } = useSesion();
  const cerrarSesion = useCerrarSesion();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  // Ruta en la que se abrió el menú del avatar: al navegar a otra queda cerrado sin un efecto que lo cierre
  const [menuAbiertoEn, setMenuAbiertoEn] = useState<string | null>(null);
  const avatarMenuOpen = menuAbiertoEn === pathname;
  const avatarMenuRef = useRef<HTMLDivElement | null>(null);
  const { showToast } = useToast();

  const activePath = useMemo(() => pathname, [pathname]);
  const authProvider = session?.user?.authProvider;
  const isGoogleLogin = authProvider === "google";
  const avatarImage = isGoogleLogin ? session?.user?.image : null;
  const userDisplayName = session?.user?.name || session?.user?.email || TEXTOS.administrador[language];
  const userInitials = useMemo(() => {
    const base = session?.user?.name || session?.user?.email || "A";
    const parts = base.trim().split(/\s+/).filter(Boolean);

    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    return base.slice(0, 2).toUpperCase();
  }, [session?.user?.name, session?.user?.email]);

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
        setMenuAbiertoEn(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuAbiertoEn(null);
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
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">{TEXTOS.centro[language]}</p>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 lg:hidden"
                aria-label={TEXTOS.cerrarMenu[language]}
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Aquí había un "Estado global: Operativo" fijo, siempre en verde, que no medía nada. El estado real de los
                módulos está en el Resumen del panel ("Estado general"). */}
            <Separator />

            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                // Las pestañas comparten ruta: se distinguen por ?pestana=. Negocios, Citas y Soporte son rutas propias.
                const isActive = item.pestana
                  ? activePath === "/dashboard/admin" && pestanaActual === item.pestana
                  : rutaActiva(activePath, item.href, "/dashboard/admin");

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
                    <span>{item.label[language]}</span>
                    {/* Solo en la activa, como en cliente y negocio: en todas parecía un submenú desplegable */}
                    {isActive ? <ChevronRight className="ml-auto size-4 text-white" /> : null}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
                <Sparkles className="size-3.5 text-indigo-500" />
                {TEXTOS.modoAdmin[language]}
              </p>
              <p className="mt-1 text-xs text-slate-500">{TEXTOS.controlTotal[language]}</p>
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
                <Button variant="outline" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)} aria-label={TEXTOS.abrirMenu[language]}>
                  <Menu className="size-4" />
                </Button>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">{TEXTOS.administracion[language]}</p>
                  <p className="text-sm font-bold text-slate-900">{TEXTOS.panelOficial[language]}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative" ref={avatarMenuRef}>
                  <button
                    type="button"
                    onClick={() => setMenuAbiertoEn((abiertoEn) => (abiertoEn === pathname ? null : pathname))}
                    className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-white text-sm font-bold text-slate-900 shadow-sm transition hover:shadow-md"
                    aria-label={TEXTOS.menuUsuario[language]}
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
                        <p className="text-xs text-slate-500">{isGoogleLogin ? "Google" : TEXTOS.correoYContrasena[language]}</p>
                      </div>

                      <Link
                        href="/"
                        onClick={() => setMenuAbiertoEn(null)}
                        className="mt-1 flex w-full items-center rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                        role="menuitem"
                      >
                        {TEXTOS.irAlSitio[language]}
                      </Link>
                      <button
                        type="button"
                        disabled={loggingOut}
                        onClick={() => {
                          setMenuAbiertoEn(null);
                          setLogoutDialogOpen(true);
                        }}
                        className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
                        role="menuitem"
                      >
                        {loggingOut ? TEXTOS.cerrando[language] : TEXTOS.cerrarSesion[language]}
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
                <AlertDialogTitle>{TEXTOS.preguntaCerrar[language]}</AlertDialogTitle>
                <AlertDialogDescription>
                  {TEXTOS.avisoCerrar[language]}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  onClick={() => {
                    showToast({
                      type: "info",
                      title: TEXTOS.accionCancelada[language],
                      message: TEXTOS.seguisteConSesion[language],
                    });
                  }}
                >
                  {TEXTOS.cancelar[language]}
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={loggingOut}
                  onClick={async () => {
                    try {
                      setLoggingOut(true);
                      showToast({
                        type: "success",
                        title: TEXTOS.cerrandoSesion[language],
                        message: TEXTOS.redirigiendo[language],
                      });
                      await cerrarSesion("/iniciar-sesion");
                    } finally {
                      setLoggingOut(false);
                    }
                  }}
                >
                  {loggingOut ? TEXTOS.cerrando[language] : TEXTOS.siCerrar[language]}
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
