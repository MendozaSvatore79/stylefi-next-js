import Link from "next/link";
import Image from "next/image";
import { connection } from "next/server";

import AuraSinSesion from "@/components/aura-sin-sesion";
import { LiveDashboardPanel } from "@/components/live-dashboard-panel";
import { urlDelBackend } from "@/lib/api";

/** Segundos que se reutiliza la respuesta de GET /live-dashboard entre visitas a la portada. */
const REVALIDAR_MANTENIMIENTO_S = 30;

/**
 * ¿La plataforma está en mantenimiento? Lo pregunta al backend (GET /live-dashboard, público). Es la misma respuesta
 * para todos, así que va sin token y con caché de 30 s: cada visita a la portada ya no llega al backend (antes
 * pasaba por apiServidor, que fuerza no-store, y era la mayoría de las llamadas desde el servidor). Si no se puede
 * saber, se muestra la portada normal.
 */
async function enMantenimiento(): Promise<boolean> {
  const base = urlDelBackend();
  if (!base) return false;
  try {
    const r = await fetch(`${base}/live-dashboard`, { next: { revalidate: REVALIDAR_MANTENIMIENTO_S } });
    return r.ok ? Boolean(((await r.json()) as { isMaintenanceMode?: boolean }).isMaintenanceMode) : false;
  } catch {
    return false;
  }
}

const techFeatures = [
  {
    titulo: "Agenda inteligente",
    descripcion: "Bloquea horarios, evita choques y sugiere citas disponibles en tiempo real.",
    etiqueta: "Agenda",
    icono: "⚡",
  },
  {
    titulo: "Panel por roles",
    descripcion: "Cliente, negocio y admin con vistas separadas y flujos claros para cada usuario.",
    etiqueta: "Por roles",
    icono: "🧩",
  },
  {
    titulo: "Reservas confiables",
    descripcion: "Confirmaciones, seguimiento y historial para barberías, estética y uñas.",
    etiqueta: "Reservas",
    icono: "✓",
  },
  {
    titulo: "Diseño premium",
    descripcion: "Funciona igual en el celular, la tableta y la computadora.",
    etiqueta: "Diseño",
    icono: "✦",
  },
];

// Ideas de estilo (fotos de Unsplash, guardadas en public/estilos). Sin nombres ni calificaciones: no son
// profesionales ni reseñas reales.
const estilos = [
  { nombre: "Corte clásico", foto: "/estilos/corte-clasico.jpg" },
  { nombre: "Fade", foto: "/estilos/fade.jpg" },
  { nombre: "Barba", foto: "/estilos/barba.jpg" },
  { nombre: "Estilo moderno", foto: "/estilos/estilo-moderno.jpg" },
];

export default async function Home() {
  await connection();

  const isMaintenanceMode = await enMantenimiento();

  return (
    <main className="min-h-screen w-full overflow-hidden bg-white text-neutral-900">
      {isMaintenanceMode ? (
        <section className="fixed inset-0 z-120 flex items-center justify-center bg-[#080d1f]/92 px-6 text-white backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-white/20 bg-white/10 p-8 text-center shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Plataforma temporalmente no disponible</p>
            <h1 className="mt-3 text-3xl font-black sm:text-4xl">Estamos en mantenimiento</h1>
            <p className="mt-4 text-sm text-white/80 sm:text-base">
              Estamos ajustando módulos internos para mejorar la estabilidad del servicio. Vuelve a intentar en unos minutos.
            </p>
          </div>
        </section>
      ) : null}

      <div className="fixed inset-0 -z-10 bg-white" />
      <div className="fixed left-0 top-0 -z-10 h-128 w-lg rounded-full bg-neutral-200/40 blur-3xl animate-drift" />
      <div className="fixed right-0 top-24 -z-10 h-120 w-120 rounded-full bg-red-100/50 blur-3xl animate-drift" />

      <header className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-white/95 px-4 py-3 text-neutral-950 shadow-[0_8px_24px_rgba(0,0,0,0.06)] backdrop-blur-xl sm:px-7">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3" aria-label="Ir al inicio de STYLEHUB">
            <Image
              src="/brand/stylehub-app.png"
              alt=""
              width={44}
              height={44}
              loading="eager"
              className="h-11 w-11 rounded-[15px] border border-neutral-200 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
            />
            <span className="text-lg font-black tracking-[0.16em] text-neutral-950 sm:text-xl">STYLEHUB</span>
          </Link>
          <nav className="flex w-full items-center justify-end gap-2 text-[11px] font-bold uppercase tracking-wide sm:w-auto sm:gap-3 sm:text-sm">
            <Link
              href="/register"
              className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-neutral-950 transition hover:-translate-y-0.5 hover:bg-neutral-100 sm:px-5"
            >
              Regístrate
            </Link>
            <Link
              href="/iniciar-sesion"
              className="rounded-full bg-neutral-950 px-4 py-2 text-white transition hover:-translate-y-0.5 hover:bg-red-600 hover:shadow-lg hover:shadow-red-600/20 sm:px-5"
            >
              Iniciar sesión
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-neutral-100 bg-white px-4 pb-14 pt-10 sm:px-8 sm:pt-14 lg:px-16 lg:py-16">
        <div className="absolute -left-20 top-10 h-80 w-80 rounded-full bg-neutral-200/50 blur-3xl animate-drift" />
        <div className="absolute right-0 top-24 h-96 w-96 rounded-full bg-red-100/60 blur-3xl animate-drift" />
        <div className="absolute bottom-10 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-neutral-100 blur-3xl animate-float-slow" />

        <div className="relative mx-auto grid w-full max-w-7xl gap-8 lg:grid-cols-[1.04fr_0.96fr] lg:items-start lg:gap-8">
          <div className="rounded-4xl border border-neutral-200 bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.08)] backdrop-blur-md sm:p-8 lg:p-9">
            <div className="stagger-enter inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/90" style={{ animationDelay: "60ms" }}>
              <span className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_18px_rgba(239,68,68,0.65)]" />
              La agenda inteligente de belleza
            </div>

            <h1 className="stagger-enter mt-5 max-w-4xl text-4xl font-black uppercase leading-[0.92] tracking-tight text-neutral-950 sm:text-6xl lg:text-7xl" style={{ animationDelay: "120ms" }}>
              Tu estilo, tu tiempo, <span className="text-red-700">todo reservado</span>
            </h1>

            <p className="stagger-enter mt-4 max-w-2xl text-sm text-slate-700 sm:text-base lg:text-lg" style={{ animationDelay: "180ms" }}>
              Encuentra profesionales, agenda tu próxima cita y administra tu negocio desde una experiencia visual rápida y confiable.
            </p>

            <div className="stagger-enter mt-8 flex flex-wrap gap-3" style={{ animationDelay: "230ms" }}>
              <Link
                href="/iniciar-sesion"
                className="inline-flex h-12 items-center justify-center rounded-full bg-neutral-950 px-6 text-sm font-semibold text-white shadow-lg shadow-neutral-950/20 transition hover:-translate-y-0.5 hover:bg-red-600 hover:shadow-xl"
              >
                Reservar una cita
              </Link>
              <Link
                href="/register"
                className="inline-flex h-12 items-center justify-center rounded-full border border-neutral-300 bg-white px-6 text-sm font-semibold text-neutral-950 transition hover:-translate-y-0.5 hover:bg-neutral-100"
              >
                Crear cuenta
              </Link>
            </div>

          </div>

          <div className="stagger-enter relative lg:pt-2" style={{ animationDelay: "220ms" }}>
            <div className="pointer-events-none absolute -inset-5 rounded-[2.2rem] bg-neutral-200/50 blur-2xl animate-drift" />
            <div className="relative rounded-4xl border border-neutral-200 bg-neutral-950 p-4 shadow-[0_22px_55px_rgba(0,0,0,0.18)] sm:p-5 animate-float-slow">
              <LiveDashboardPanel />
            </div>
          </div>

        </div>
      </section>

      <section className="mx-auto max-w-[calc(80rem+2rem)] px-4 py-12 sm:px-8 lg:px-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold uppercase tracking-tight text-neutral-950 sm:text-3xl">
              Todo tu negocio, en movimiento
            </h2>
            <p className="mt-1 text-sm text-slate-600">Una plataforma diseñada para cada parte de tu experiencia.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {techFeatures.map((feature, index) => (
            <article
              key={feature.titulo}
              className={`stagger-enter group rounded-3xl border p-5 shadow-[0_12px_30px_rgba(0,0,0,0.07)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(0,0,0,0.12)] ${index === 0 ? "border-neutral-950 bg-neutral-950 text-white ring-1 ring-red-500/20" : "border-neutral-200 bg-white text-neutral-900"}`}
              style={{ animationDelay: `${90 + index * 70}ms` }}
            >
              <div className="flex items-center justify-between">
                <span className={`flex h-11 w-11 items-center justify-center rounded-2xl text-xl ${index === 0 ? "bg-red-600 text-white shadow-[0_0_18px_rgba(220,38,38,0.35)]" : "bg-neutral-950 text-white"}`}>
                  {feature.icono}
                </span>
                <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${index === 0 ? "bg-red-600 text-white" : "bg-neutral-100 text-neutral-700"}`}>
                  {feature.etiqueta}
                </span>
              </div>
              <h3 className={`mt-5 text-xl font-black ${index === 0 ? "text-white" : "text-slate-900"}`}>{feature.titulo}</h3>
              <p className={`mt-2 text-sm leading-6 ${index === 0 ? "text-white/85" : "text-slate-600"}`}>
                {feature.descripcion}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[calc(80rem+2rem)] px-4 py-12 sm:px-8 lg:px-16">
        <article className="overflow-hidden rounded-4xl border border-neutral-200 bg-white p-4 shadow-[0_16px_40px_rgba(0,0,0,0.08)] backdrop-blur-xl sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-extrabold uppercase tracking-tight text-neutral-950 sm:text-3xl">
                Encuentra tu próximo look
              </h2>
              <p className="mt-1 text-sm text-neutral-600">Ideas de estilo para tu próxima cita.</p>
            </div>
            <span className="w-fit rounded-full bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-red-700">
              Inspiración
            </span>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {estilos.map((item, index) => (
                <article
                  key={item.nombre}
                  className="stagger-enter group relative isolate h-64 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-950 shadow-[0_10px_22px_rgba(0,0,0,0.16)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(220,38,38,0.18)] sm:h-72 xl:h-80"
                  style={{ animationDelay: `${120 + index * 60}ms` }}
                >
                  <Image
                    src={item.foto}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 25vw, 50vw"
                    className="object-cover transition duration-700 group-hover:scale-105"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/95 via-black/35 to-black/5" />

                  <div className="absolute bottom-0 z-10 w-full p-3 text-white sm:p-4">
                    <p className="text-xl leading-[1.02] font-black text-white sm:text-2xl">{item.nombre}</p>
                  </div>
                </article>
              ))}
          </div>
        </article>

        <article className="mt-6 overflow-hidden rounded-4xl border border-neutral-950 bg-neutral-950 p-5 text-white shadow-[0_16px_40px_rgba(0,0,0,0.16)] backdrop-blur-xl sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-400">Un ecosistema completo</p>
            <h3 className="mt-2 text-2xl font-black sm:text-3xl">Todo bajo control desde un solo lugar</h3>
            <p className="mt-2 text-sm leading-6 text-white/75">
              Una experiencia pensada para clientes, equipos y administradores, con una navegación clara y visual.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Cliente</p>
                <p className="mt-2 text-lg font-bold">Reserva rápido</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Negocio</p>
                <p className="mt-2 text-lg font-bold">Gestiona agenda</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Admin</p>
                <p className="mt-2 text-lg font-bold">Control total</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Recordatorios</p>
                <p className="mt-2 text-lg font-bold">Te avisamos un día antes</p>
              </div>
            </div>

          </article>
      </section>

      <section className="mx-auto max-w-[calc(80rem+2rem)] px-4 pb-12 pt-2 sm:px-8 lg:px-16">
        <div className="grid gap-6 sm:grid-cols-2">
          <article className="overflow-hidden rounded-4xl border border-neutral-200 bg-neutral-100 shadow-[0_16px_40px_rgba(0,0,0,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-xl">
            <div className="flex min-h-72 flex-col sm:flex-row">
              <div className="flex flex-1 flex-col justify-between p-6 sm:p-8">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-red-700">Negocios</p>
                  <h3 className="mt-3 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
                    ¿Tienes un negocio?<br />
                    ¡Conoce STYLEHUB!
                  </h3>
                </div>
                <Link
                  href="/register"
                  className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-neutral-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-red-600 hover:shadow-lg"
                >
                  Conócenos <span aria-hidden>➜</span>
                </Link>
              </div>
              <div className="relative h-44 w-full sm:h-auto sm:w-[40%]">
                <Image src="/estilos/negocio.jpg" alt="" fill sizes="(min-width: 640px) 40vw, 100vw" className="object-cover" />
              </div>
            </div>
          </article>

          <article className="overflow-hidden rounded-4xl border border-white/20 bg-red-50 shadow-[0_16px_40px_rgba(15,23,42,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-xl">
            <div className="flex min-h-72 flex-col sm:flex-row">
              <div className="flex flex-1 flex-col justify-between p-6 sm:p-8">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-red-700">Admin</p>
                  <h3 className="mt-3 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
                    Lleva tu negocio a otro nivel
                  </h3>
                  <p className="mt-4 max-w-sm text-sm leading-6 text-slate-700">
                    Automatiza reservas, revisa métricas y administra tu operación con una vista elegante.
                  </p>
                </div>
                <Link
                  href="/register"
                  className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  Más información <span aria-hidden>➜</span>
                </Link>
              </div>
              <div className="relative h-44 w-full sm:h-auto sm:w-[40%]">
                <Image src="/estilos/negocio-equipo.jpg" alt="" fill sizes="(min-width: 640px) 40vw, 100vw" className="object-cover" />
              </div>
            </div>
          </article>
        </div>
      </section>

      <footer className="border-t border-neutral-200 bg-white px-4 py-10 text-neutral-950 sm:px-8 lg:px-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 border-b border-neutral-200 pb-8 md:grid-cols-[1.4fr_0.6fr_0.8fr]">
            <div>
              <Link href="/" className="flex items-center gap-3" aria-label="Ir al inicio de STYLEHUB">
                <Image
                  src="/brand/stylehub-app.png"
                  alt=""
                  width={52}
                  height={52}
                  className="h-12 w-12 rounded-[18px]"
                />
                <span className="text-xl font-black tracking-[0.16em] text-neutral-950">STYLEHUB</span>
              </Link>
              <p className="mt-3 max-w-md text-sm leading-6 text-neutral-600">
                Tecnología para reservar, gestionar y hacer crecer negocios de belleza con una experiencia moderna.
              </p>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-neutral-500">Plataforma</p>
              <nav className="mt-4 flex flex-col gap-3 text-sm text-neutral-600" aria-label="Navegación del pie">
                <Link href="/" className="transition hover:text-red-600">Inicio</Link>
                <Link href="/iniciar-sesion" className="transition hover:text-red-600">Iniciar sesión</Link>
                <Link href="/register" className="transition hover:text-red-600">Crear cuenta</Link>
                <Link href="/terms-of-service" className="transition hover:text-red-600">Términos de servicio</Link>
                <Link href="/privacy-policy" className="transition hover:text-red-600">Política de privacidad</Link>
              </nav>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-600">Comienza ahora</p>
              <p className="mt-4 text-sm leading-6 text-neutral-600">
                Reserva tu próximo servicio o administra tu negocio desde un solo lugar.
              </p>
              <Link
                href="/register"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-neutral-950/20 transition hover:-translate-y-0.5 hover:bg-red-600"
              >
                Crear cuenta <span aria-hidden>➜</span>
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-6 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
            <p>&copy; {new Date().getFullYear()} STYLEHUB. Todos los derechos reservados.</p>
            <p className="uppercase tracking-[0.16em]">Agenda belleza inteligente</p>
          </div>
        </div>
      </footer>
      <AuraSinSesion />
    </main>
  );
}
