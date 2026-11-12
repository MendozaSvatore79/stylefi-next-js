"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Search, SlidersHorizontal, Sparkles, X } from "lucide-react";

import SalonModal from "@/components/salon-modal";

type Business = {
  id: string;
  business_name: string;
  first_name: string;
  last_name: string;
  salon_name: string;
  description: string;
  address?: string | null;
  city: string;
  state?: string | null;
  image_url: string;
  service_summary?: string | null;
};

const CATEGORY_FILTERS = [
  { label: "Barbería", keywords: ["barber", "corte", "fade", "barba"] },
  { label: "Estética", keywords: ["estetic", "facial", "piel", "ceja", "pestaña"] },
  { label: "Uñas", keywords: ["uña", "unas", "manicure", "pedicure", "nail"] },
  { label: "Spa", keywords: ["spa", "masaje", "relaj", "wellness"] },
  { label: "Maquillaje", keywords: ["maquill", "makeup", "glam", "beauty"] },
] as const;

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default function SalonDiscovery() {
  const { status } = useSession();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [draftServiceQuery, setDraftServiceQuery] = useState("");
  const [draftBusinessQuery, setDraftBusinessQuery] = useState("");
  const [appliedServiceQuery, setAppliedServiceQuery] = useState("");
  const [appliedBusinessQuery, setAppliedBusinessQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBusiness, setSelectedBusiness] = useState<string | null>(null);
  const [lockedBusiness, setLockedBusiness] = useState<Business | null>(null);

  useEffect(() => {
    if (!isSearchOpen && !selectedBusiness && !lockedBusiness) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isSearchOpen, lockedBusiness, selectedBusiness]);

  useEffect(() => {
    const loadBusinesses = async () => {
      try {
        const response = await fetch("/api/businesses", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { businesses: Business[] };
        setBusinesses(payload.businesses ?? []);
      } finally {
        setIsLoading(false);
      }
    };

    void loadBusinesses();
  }, []);

  const filteredBusinesses = useMemo(() => {
    const serviceQuery = normalizeText(appliedServiceQuery);
    const businessQuery = normalizeText(appliedBusinessQuery);

    return businesses.filter((business) => {
      const searchableText = normalizeText(
        [
          business.business_name,
          business.salon_name,
          business.description,
          business.address,
          business.city,
          business.state,
          business.service_summary,
        ]
          .filter(Boolean)
          .join(" "),
      );

      if (businessQuery && !searchableText.includes(businessQuery)) {
        return false;
      }

      if (serviceQuery && !searchableText.includes(serviceQuery)) {
        return false;
      }

      if (activeCategory !== "all") {
        const category = CATEGORY_FILTERS.find((item) => item.label === activeCategory);
        if (!category) {
          return true;
        }

        const serviceText = normalizeText(business.service_summary ?? "");
        const categoryMatch = category.keywords.some((keyword) => serviceText.includes(normalizeText(keyword)));
        if (!categoryMatch) {
          return false;
        }
      }

      return true;
    });
  }, [activeCategory, appliedBusinessQuery, appliedServiceQuery, businesses]);

  const openBusinessDetails = (business: Business) => {
    if (status !== "authenticated") {
      setLockedBusiness(business);
      setIsSearchOpen(false);
      return;
    }

    setSelectedBusiness(business.id);
    setIsSearchOpen(false);
  };

  const applySearch = () => {
    setAppliedBusinessQuery(draftBusinessQuery);
    setAppliedServiceQuery(draftServiceQuery);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsSearchOpen(true)}
        className="group w-full cursor-pointer overflow-hidden rounded-4xl border border-white/60 bg-linear-to-br from-white via-[#fbfbff] to-[#eef2ff] p-5 text-left shadow-[0_24px_60px_rgba(15,23,42,0.10)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_30px_80px_rgba(59,130,246,0.18)] sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-blue-700">
              <Sparkles className="size-3.5" />
              Buscador inteligente
            </p>
            <h3 className="mt-3 text-xl font-black tracking-tight text-[#151138] sm:text-2xl">Buscar salones y servicios</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Abre el modal para filtrar por servicio, negocio y categoría con una experiencia mucho más limpia.
            </p>
          </div>

          <span className="inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-blue-700 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition group-hover:scale-105">
            <Search className="size-4" />
            Buscar
          </span>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white/90 px-3 py-2.5 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Servicios</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-700">{draftServiceQuery || "Buscar por servicio"}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/90 px-3 py-2.5 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Negocio</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-700">{draftBusinessQuery || "Buscar por salón"}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/90 px-3 py-2.5 shadow-sm">
            <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              <SlidersHorizontal className="size-3" /> Filtro
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-700">{activeCategory === "all" ? "Todos" : activeCategory}</p>
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-600">
          Filtros avanzados y resultados en ventana modal. {status === "authenticated" ? "Tu sesión permite ver detalles completos." : "Inicia sesión para abrir los detalles."}
        </p>
      </button>

      {isSearchOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 px-4 py-4 backdrop-blur-md sm:items-center sm:px-6"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsSearchOpen(false);
            }
          }}
        >
          <div className="my-auto flex h-[min(84vh,760px)] w-full max-w-6xl flex-col overflow-hidden rounded-4xl border border-white/60 bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-indigo-600">Buscador de salones</p>
                <h3 className="mt-1 text-2xl font-black text-[#151138]">Explora servicios con filtros</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSearchOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition hover:bg-slate-50"
                aria-label="Cerrar buscador"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="grid flex-1 min-h-0 gap-4 p-4 sm:p-5 xl:grid-cols-[320px_1fr]">
              <aside className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="space-y-3">
                  <label className="block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Buscar servicios</label>
                  <input
                    type="text"
                    value={draftServiceQuery}
                    onChange={(event) => setDraftServiceQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        applySearch();
                      }
                    }}
                    placeholder="Corte, uñas, spa..."
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-indigo-300 focus:ring"
                  />

                  <label className="block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Buscar negocio</label>
                  <input
                    type="text"
                    value={draftBusinessQuery}
                    onChange={(event) => setDraftBusinessQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        applySearch();
                      }
                    }}
                    placeholder="Nombre del salón"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-indigo-300 focus:ring"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Categorías</label>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveCategory("all")}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${activeCategory === "all" ? "border-blue-700 bg-blue-700 text-white" : "border-blue-900/10 bg-white text-slate-700"}`}
                    >
                      Todos
                    </button>
                    {CATEGORY_FILTERS.map((category) => (
                      <button
                        key={category.label}
                        type="button"
                        onClick={() => setActiveCategory(category.label)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${activeCategory === category.label ? "border-blue-700 bg-blue-700 text-white" : "border-blue-900/10 bg-white text-slate-700"}`}
                      >
                        {category.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
                  <p className="font-semibold text-slate-800">{filteredBusinesses.length} resultados</p>
                  <p className="mt-1">{status === "authenticated" ? "Puedes abrir cada salón y ver sus detalles completos." : "Necesitas iniciar sesión para abrir el detalle completo."}</p>
                </div>

                <button
                  type="button"
                  onClick={applySearch}
                  className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-blue-700 px-6 text-sm font-semibold text-white transition hover:bg-blue-800"
                >
                  Aplicar filtros
                </button>
              </aside>

              <section className="flex min-h-0 flex-col rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
                  <p className="text-sm font-semibold text-slate-700">Resultados</p>
                  <p className="text-xs text-slate-500">
                    {status === "authenticated" ? "Detalles completos disponibles" : "Vista pública hasta iniciar sesión"}
                  </p>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-5">
                  {isLoading ? (
                    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                      {[1, 2, 3].map((item) => (
                        <div key={item} className="h-88 overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="h-44 animate-pulse rounded-2xl bg-linear-to-br from-slate-100 to-slate-200" />
                          <div className="mt-4 h-4 w-2/3 animate-pulse rounded bg-slate-200" />
                          <div className="mt-3 h-3 w-full animate-pulse rounded bg-slate-200" />
                          <div className="mt-2 h-3 w-5/6 animate-pulse rounded bg-slate-200" />
                          <div className="mt-5 h-8 w-28 animate-pulse rounded-xl bg-slate-200" />
                        </div>
                      ))}
                    </div>
                  ) : filteredBusinesses.length === 0 ? (
                    <div className="rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 px-8 py-16 text-center">
                      <p className="text-4xl">🏢</p>
                      <p className="mt-4 text-lg font-bold text-[#151138]">No encontramos salones con esos filtros</p>
                      <p className="mt-2 text-slate-600">Prueba con otros servicios, otra categoría o limpia el buscador.</p>
                    </div>
                  ) : (
                    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                      {filteredBusinesses.map((business, index) => (
                        <article
                          key={business.id}
                          className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white text-left shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-indigo-200/40"
                          style={{ animationDelay: `${80 + index * 60}ms` }}
                        >
                          <div className="absolute right-3 top-3 z-10 rounded-full border border-white/40 bg-black/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                            Verificado
                          </div>

                          <button type="button" onClick={() => openBusinessDetails(business)} className="block w-full text-left">
                            <div className="relative h-48 overflow-hidden bg-linear-to-br from-indigo-100 to-purple-100">
                              {business.image_url ? (
                                <Image
                                  src={business.image_url}
                                  alt={business.salon_name || business.business_name}
                                  fill
                                  unoptimized
                                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-4xl">💇</div>
                              )}
                              <div className="absolute inset-0 bg-linear-to-t from-black/35 via-black/0 to-transparent" />
                            </div>

                            <div className="p-6">
                              <h4 className="text-xl font-black text-[#151138] transition-colors group-hover:text-indigo-600">
                                {business.salon_name || business.business_name}
                              </h4>
                              <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                                {business.description || "Explora los servicios disponibles y reserva cuando estés listo."}
                              </p>

                              {business.service_summary ? (
                                <p className="mt-3 line-clamp-1 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
                                  {business.service_summary}
                                </p>
                              ) : null}

                              <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600">
                                <span>📍</span>
                                <span>{[business.city, business.state].filter(Boolean).join(", ") || business.address || "Ubicación disponible"}</span>
                              </div>

                              <div className="mt-4 flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                                  {status === "authenticated" ? "Ver detalles" : "Inicia sesión para ver detalles"}
                                </span>
                                <span className="text-lg transition-transform group-hover:translate-x-1">→</span>
                              </div>
                            </div>
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {selectedBusiness ? <SalonModal businessId={selectedBusiness} onClose={() => setSelectedBusiness(null)} /> : null}

      {lockedBusiness ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-3xl border border-white/40 bg-white p-6 text-center shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-indigo-600">Acceso restringido</p>
            <h3 className="mt-2 text-2xl font-black text-[#151138]">Inicia sesión para ver más detalles</h3>
            <p className="mt-3 text-sm text-slate-600">
              Puedes explorar el listado público, pero para abrir servicios, estilistas y reservar necesitas autenticarte.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setLockedBusiness(null)}
                className="h-11 flex-1 rounded-xl border border-slate-300 font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Ahora no
              </button>
              <Link
                href="/iniciar-sesion"
                className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-blue-700 font-bold text-white transition hover:bg-blue-800"
              >
                Iniciar sesión
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}