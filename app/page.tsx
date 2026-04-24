import Link from "next/link";

const techFeatures = [
  {
    titulo: "Agenda inteligente",
    descripcion: "Bloquea horarios, evita choques y sugiere citas disponibles en tiempo real.",
    etiqueta: "AI Scheduling",
    icono: "⚡",
  },
  {
    titulo: "Panel por roles",
    descripcion: "Cliente, negocio y admin con vistas separadas y flujos claros para cada usuario.",
    etiqueta: "Role-based UX",
    icono: "🧩",
  },
  {
    titulo: "Reservas confiables",
    descripcion: "Confirmaciones, seguimiento y historial para barberías, estética y uñas.",
    etiqueta: "Smart Booking",
    icono: "✓",
  },
  {
    titulo: "Diseño premium",
    descripcion: "Interfaz visual, rápida y responsiva lista para crecer como producto SaaS.",
    etiqueta: "Modern UI",
    icono: "✦",
  },
];

const recomendaciones = [
  {
    nombre: "Leyva",
    frase: "El mejor corte",
    rating: "4.9",
    foto: "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=800&q=80",
  },
  {
    nombre: "Jona",
    frase: "Como siempre al 100",
    rating: "4.8",
    foto: "https://images.unsplash.com/photo-1599351431408-5a13587f6f3f?auto=format&fit=crop&w=800&q=80",
  },
  {
    nombre: "Crisóstomo",
    frase: "Quedé como CR7",
    rating: "4.8",
    foto: "https://images.unsplash.com/photo-1517832606299-7ae9b720a186?auto=format&fit=crop&w=800&q=80",
  },
  {
    nombre: "Carlitos",
    frase: "Todo cool",
    rating: "4.7",
    foto: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80",
  },
  {
    nombre: "Maldonado",
    frase: "El mejor barber",
    rating: "4.9",
    foto: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=800&q=80",
  },
];

const categorias = ["Barbería", "Estética", "Uñas", "Spa", "Maquillaje"];

const metricas = [
  { valor: "+1500", etiqueta: "Negocios activos" },
  { valor: "+22k", etiqueta: "Reservas al mes" },
  { valor: "4.9", etiqueta: "Calificación promedio" },
];

const stackItems = [
  { nombre: "Next.js 16", detalle: "Rutas, layouts y server components" },
  { nombre: "Tailwind CSS", detalle: "UI rápida y escalable" },
  { nombre: "App Router", detalle: "Estructura limpia por vistas" },
  { nombre: "Gestión de citas", detalle: "Cliente · Negocio · Admin" },
];

export default function Home() {
  return (
    <main className="min-h-screen w-full overflow-hidden bg-[#ececef] text-slate-900">
      <div className="fixed inset-0 -z-10 bg-[#ececef]" />
      <div className="fixed left-0 top-0 -z-10 h-128 w-lg rounded-full bg-blue-500/15 blur-3xl animate-drift" />
      <div className="fixed right-0 top-24 -z-10 h-120 w-120 rounded-full bg-red-500/12 blur-3xl animate-drift" />

      <header className="sticky top-0 z-40 w-full border-b border-blue-950/10 bg-[#0d1b3d] px-4 py-3 text-white shadow-[0_10px_30px_rgba(0,0,0,0.18)] sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="text-2xl font-black tracking-[0.18em] text-white sm:text-3xl">
            STYLEHUB
          </Link>
          <nav className="flex w-full items-center justify-end gap-2 text-[11px] font-bold uppercase tracking-wide sm:w-auto sm:gap-3 sm:text-sm">
            <Link
              href="/register"
              className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-white transition hover:-translate-y-0.5 hover:bg-white/15 sm:px-5"
            >
              Regístrate
            </Link>
            <Link
              href="/iniciar-sesion"
              className="rounded-full bg-blue-700 px-4 py-2 text-white transition hover:-translate-y-0.5 hover:bg-blue-800 hover:shadow-lg hover:shadow-blue-500/30 sm:px-5"
            >
              Iniciar sesión
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative min-h-screen overflow-hidden bg-[#eef2ff] px-4 pb-12 pt-12 sm:px-8 sm:pt-16 lg:px-16 lg:pt-20">
        <div className="absolute -left-20 top-10 h-80 w-80 rounded-full bg-blue-500/15 blur-3xl animate-drift" />
        <div className="absolute right-0 top-24 h-96 w-96 rounded-full bg-red-500/14 blur-3xl animate-drift" />
        <div className="absolute bottom-10 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-300/8 blur-3xl animate-float-slow" />

        <div className="relative mx-auto grid w-full max-w-7xl gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:gap-10">
          <div className="rounded-4xl border border-blue-950/10 bg-white/70 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.10)] backdrop-blur-md sm:p-8 lg:p-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-900/10 bg-blue-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/90">
              <span className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_18px_rgba(239,68,68,0.65)]" />
              Agenda tecnológica para negocios de belleza
            </div>

            <h1 className="mt-5 max-w-4xl text-4xl font-black uppercase leading-[0.95] tracking-tight text-[#0d1b3d] sm:text-6xl lg:text-7xl">
              Reserva belleza con una experiencia <span className="text-red-700">moderna</span>
            </h1>

            <p className="mt-4 max-w-2xl text-sm text-slate-700 sm:text-base lg:text-lg">
              Un home futurista para tu sistema de citas: clientes, negocios y admin en una interfaz visual, rápida y lista para escalar.
            </p>

            <div className="mt-8 flex w-full max-w-4xl flex-col gap-3 rounded-3xl border border-blue-900/10 bg-white p-3 shadow-2xl shadow-black/10 sm:flex-row sm:p-4">
              <div className="flex h-12 items-center rounded-full bg-slate-50 px-4 shadow-lg sm:flex-[1.45]">
                <span aria-hidden className="mr-3 text-lg text-blue-900">⌕</span>
                <input
                  type="text"
                  placeholder="Buscar servicios"
                  className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none"
                />
                <span className="ml-3 border-l border-slate-200 pl-3 text-lg text-blue-900">⚙</span>
              </div>

              <div className="flex h-12 items-center rounded-full bg-slate-50 px-5 shadow-lg sm:flex-1">
                <input
                  type="text"
                  placeholder="Buscar negocio"
                  className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none"
                />
              </div>

              <button className="h-12 rounded-full bg-blue-700 px-6 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:-translate-y-0.5 hover:bg-blue-800 hover:shadow-xl">
                Buscar ahora
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {categorias.map((categoria) => (
                <span
                  key={categoria}
                  className="rounded-full border border-blue-900/10 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                >
                  {categoria}
                </span>
              ))}
            </div>

            <div className="mt-6 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
              {metricas.map((item) => (
                <article key={item.etiqueta} className="rounded-2xl border border-blue-900/10 bg-white p-4 text-slate-900 shadow-sm">
                  <p className="text-2xl font-black text-blue-950 sm:text-3xl">{item.valor}</p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{item.etiqueta}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-135">
            <div className="absolute -left-4 -top-4 h-full w-full rounded-4xl border border-white/10 bg-blue-500/10 blur-xl animate-float-slow" />
            <div className="relative overflow-hidden rounded-4xl border border-white/15 bg-[#10162f] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.45)] sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">Live dashboard</p>
                  <p className="mt-1 text-xl font-black text-white">Panel inteligente</p>
                </div>
                <span className="rounded-full border border-blue-300/25 bg-blue-700/20 px-3 py-1 text-xs font-semibold text-blue-200">
                  Online
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {stackItems.map((item, index) => (
                  <article
                    key={item.nombre}
                    className={`rounded-2xl border border-white/10 p-4 text-white ${index === 0 ? "bg-blue-700/35" : "bg-white/5"} ${index % 2 === 0 ? "animate-float-slow" : "animate-drift"}`}
                  >
                    <p className="text-sm font-bold">{item.nombre}</p>
                    <p className="mt-1 text-xs leading-5 text-white/70">{item.detalle}</p>
                  </article>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between text-white">
                  <span className="text-sm font-semibold">Actividad semanal</span>
                  <span className="text-xs text-white/60">+38% reservas</span>
                </div>
                <div className="mt-4 flex h-24 items-end gap-2">
                  {[34, 56, 78, 62, 90, 72, 98].map((height, index) => (
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
          </div>
        </div>
      </section>

      <section className="px-4 py-8 sm:px-8 lg:px-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold uppercase tracking-tight text-[#1a133f] sm:text-3xl">
              Soluciones tecnológicas
            </h2>
            <p className="mt-1 text-sm text-slate-600">Componentes visuales para un sistema moderno de citas.</p>
          </div>
          <span className="hidden rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-blue-700 sm:inline-flex">
            New UI Stack
          </span>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {techFeatures.map((feature, index) => (
            <article
              key={feature.titulo}
              className={`group rounded-3xl border p-5 shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(37,99,235,0.16)] ${index === 0 ? "border-blue-950/20 bg-[#0a1d4a] text-white ring-1 ring-red-500/20" : "border-white/20 bg-white/75 text-slate-900"}`}
            >
              <div className="flex items-center justify-between">
                <span className={`flex h-11 w-11 items-center justify-center rounded-2xl text-xl ${index === 0 ? "bg-red-500 text-white shadow-[0_0_18px_rgba(239,68,68,0.35)]" : "bg-blue-950 text-white"}`}>
                  {feature.icono}
                </span>
                <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${index === 0 ? "bg-red-500 text-white" : "bg-blue-50 text-blue-700"}`}>
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

      <section className="px-4 py-8 sm:px-8 lg:px-16">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="overflow-hidden rounded-4xl border border-white/20 bg-white/75 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-extrabold uppercase tracking-tight text-[#1a133f] sm:text-3xl">
                  Recomendaciones
                </h2>
                <p className="mt-1 text-sm text-slate-600">Los estilos más reservados cerca de tu ubicación.</p>
              </div>
              <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-red-700">
                En tendencia
              </span>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
              {recomendaciones.map((item) => (
                <article
                  key={item.nombre}
                  className="group relative overflow-hidden rounded-2xl bg-slate-200 shadow-sm ring-1 ring-black/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  <div
                    className="h-56 w-full bg-cover bg-center transition duration-500 group-hover:scale-110"
                    style={{ backgroundImage: `url('${item.foto}')` }}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/85 via-black/10 to-transparent" />
                  <div className="absolute bottom-0 z-10 p-3 text-white">
                    <p className="text-sm font-semibold">{item.nombre}</p>
                    <p className="text-lg leading-5 text-white/95">{item.frase}</p>
                    <p className="mt-1 text-xs font-semibold text-red-200">★ {item.rating}</p>
                  </div>
                  <span className="absolute bottom-2 left-2 z-10 h-8 w-8 rounded-full border-2 border-white bg-blue-500 shadow-[0_0_18px_rgba(59,130,246,0.45)]" />
                </article>
              ))}
            </div>
          </article>

          <article className="overflow-hidden rounded-4xl border border-white/20 bg-[#101126]/90 p-5 text-white shadow-[0_16px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-300">Stack moderno</p>
            <h3 className="mt-2 text-2xl font-black sm:text-3xl">Diseñado como un producto SaaS</h3>
            <p className="mt-2 text-sm leading-6 text-white/75">
              Tu plataforma puede verse profesional desde el primer clic, con flujos claros y componentes preparados para crecer.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
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
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">UI</p>
                <p className="mt-2 text-lg font-bold">Responsive y limpia</p>
              </div>
            </div>

            <div className="mt-5 rounded-3xl border border-white/10 bg-blue-700/20 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-white/70">Indicador de crecimiento</p>
                  <p className="mt-1 text-3xl font-black">+38% reservas</p>
                </div>
                <div className="h-16 w-16 rounded-full border border-white/15 bg-white/10 p-2">
                  <div className="h-full w-full rounded-full bg-blue-600" />
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="px-4 pb-10 pt-2 sm:px-8 lg:px-16">
        <div className="grid gap-6 sm:grid-cols-2">
          <article className="overflow-hidden rounded-4xl border border-white/20 bg-blue-50 shadow-[0_16px_40px_rgba(15,23,42,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-xl">
            <div className="flex min-h-72 flex-col sm:flex-row">
              <div className="flex flex-1 flex-col justify-between p-6 sm:p-8">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-800">Negocios</p>
                  <h3 className="mt-3 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
                    ¿Tienes un negocio?<br />
                    ¡Conoce STYLIFY!
                  </h3>
                </div>
                <Link
                  href="/registro?tipo=negocio"
                  className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-blue-950 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  Conócenos <span aria-hidden>➜</span>
                </Link>
              </div>
              <div
                className="h-44 w-full bg-cover bg-center sm:h-auto sm:w-[40%]"
                style={{
                  backgroundImage:
                    "url('https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=900&q=80')",
                }}
              />
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
                  href="/iniciar-sesion?tipo=admin"
                  className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  Más información <span aria-hidden>➜</span>
                </Link>
              </div>
              <div
                className="h-44 w-full bg-cover bg-center sm:h-auto sm:w-[40%]"
                style={{
                  backgroundImage:
                    "url('https://images.unsplash.com/photo-1622287162716-f311baa1a2b8?auto=format&fit=crop&w=900&q=80')",
                }}
              />
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
