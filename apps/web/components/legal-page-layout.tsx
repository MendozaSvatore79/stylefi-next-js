import Link from "next/link";
import type { ReactNode } from "react";

type LegalSection = {
  id: string;
  title: string;
  content: ReactNode;
};

type LegalPageLayoutProps = {
  eyebrow: string;
  title: string;
  description: string;
  accent: "blue" | "red";
  sections: LegalSection[];
  alternateHref: string;
  alternateLabel: string;
  /** Fecha de la última actualización de esta página (AAAA-MM-DD). */
  actualizado?: string;
};

export function LegalPageLayout({
  eyebrow,
  title,
  description,
  accent,
  sections,
  alternateHref,
  alternateLabel,
  actualizado = "2026-11-18",
}: LegalPageLayoutProps) {
  const accentColor = accent === "blue" ? "text-blue-700" : "text-red-700";
  const accentDot = accent === "blue" ? "bg-blue-600" : "bg-red-500";

  return (
    <main className="min-h-screen overflow-hidden bg-[#ececef] text-slate-900">
      <header className="sticky top-0 z-40 border-b border-blue-950/10 bg-[#0d1b3d] px-4 py-3 text-white shadow-[0_10px_30px_rgba(0,0,0,0.18)] sm:px-8 lg:px-16">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="text-2xl font-black tracking-[0.18em]">
            STYLEHUB
          </Link>
          <nav className="flex items-center gap-2" aria-label="Navegación legal">
            <Link
              href="/terms-of-service"
              className={`hidden rounded-full px-3 py-2 text-xs font-bold transition sm:inline-flex ${title === "Términos de servicio" ? "bg-white/10 text-white" : "text-white/65 hover:text-white"}`}
            >
              Términos
            </Link>
            <Link
              href="/privacy-policy"
              className={`hidden rounded-full px-3 py-2 text-xs font-bold transition sm:inline-flex ${title === "Política de privacidad" ? "bg-white/10 text-white" : "text-white/65 hover:text-white"}`}
            >
              Privacidad
            </Link>
            <Link
              href="/"
              className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wide transition hover:-translate-y-0.5 hover:bg-white/15"
            >
              Inicio
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative px-4 py-8 sm:px-8 sm:py-12 lg:px-16">
        <div className={`absolute ${accent === "blue" ? "-left-24" : "-right-24"} top-10 h-80 w-80 rounded-full ${accent === "blue" ? "bg-blue-500/12" : "bg-red-500/10"} blur-3xl`} />
        <div className="relative mx-auto grid max-w-7xl gap-6 lg:grid-cols-[250px_minmax(0,1fr)] lg:items-start">
          <aside className="lg:sticky lg:top-24">
            <div className="rounded-3xl border border-blue-950/10 bg-[#0d1b3d] p-5 text-white shadow-[0_16px_40px_rgba(15,23,42,0.16)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/55">En esta página</p>
              <nav className="mt-4 hidden gap-1 sm:grid lg:block" aria-label="Índice de secciones">
                {sections.map((section, index) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="group flex items-start gap-3 rounded-xl px-3 py-2.5 text-sm text-white/65 transition hover:bg-white/8 hover:text-white"
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${index === 0 ? accentDot : "bg-white/25"}`} />
                    <span>{section.title}</span>
                  </a>
                ))}
              </nav>
            </div>

            <Link
              href="/"
              className="mt-4 hidden items-center gap-2 rounded-2xl border border-blue-950/10 bg-white/70 px-4 py-3 text-sm font-semibold text-[#0d1b3d] shadow-sm transition hover:-translate-y-0.5 lg:flex"
            >
              <span aria-hidden>←</span>
              Volver al inicio
            </Link>
          </aside>

          <article className="overflow-hidden rounded-4xl border border-blue-950/10 bg-white/80 shadow-[0_20px_50px_rgba(15,23,42,0.10)] backdrop-blur-md">
            <div className="border-b border-blue-950/10 px-6 py-8 sm:px-10 sm:py-10">
              <p className={`text-xs font-bold uppercase tracking-[0.24em] ${accentColor}`}>{eyebrow}</p>
              <h1 className="mt-3 max-w-3xl text-4xl font-black uppercase leading-none tracking-tight text-[#0d1b3d] sm:text-5xl">
                {title}
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                {description}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
                <span className="rounded-full border border-blue-950/10 bg-[#eef2ff] px-3 py-1.5 text-blue-800">
                  Última actualización
                </span>
                <time dateTime={actualizado}>{fechaLarga(actualizado)}</time>
              </div>
            </div>

            <div className="divide-y divide-blue-950/8 px-6 sm:px-10">
              {sections.map((section, index) => (
                <section key={section.id} id={section.id} className="scroll-mt-28 py-8 sm:py-10">
                  <div className="flex gap-4">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black text-white ${index % 2 === 0 ? "bg-[#0d1b3d]" : "bg-red-600"}`}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-xl font-black text-[#0d1b3d] sm:text-2xl">{section.title}</h2>
                      <div className="mt-3 space-y-4 text-sm leading-7 text-slate-700 sm:text-base">
                        {section.content}
                      </div>
                    </div>
                  </div>
                </section>
              ))}
            </div>

            <div className="flex flex-col gap-3 border-t border-blue-950/10 bg-[#f7f8fc] px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-10">
              <p className="text-sm font-medium text-slate-600">¿Necesitas consultar otra información?</p>
              <Link
                href={alternateHref}
                className={`inline-flex w-fit items-center justify-center rounded-full px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 ${accent === "blue" ? "bg-blue-700 shadow-blue-500/20 hover:bg-blue-800" : "bg-[#0d1b3d] shadow-blue-950/20 hover:bg-blue-950"}`}
              >
                {alternateLabel} <span className="ml-2" aria-hidden>→</span>
              </Link>
            </div>
          </article>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#0d1b3d] px-4 py-6 text-white sm:px-8 lg:px-16">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} STYLEHUB. Todos los derechos reservados.</p>
          <p className="uppercase tracking-[0.16em]">Agenda belleza inteligente</p>
        </div>
      </footer>
    </main>
  );
}

/** "2026-11-20" → "20 de noviembre de 2026" (sin depender de la zona del servidor). */
export function fechaLarga(fecha: string) {
  return new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
