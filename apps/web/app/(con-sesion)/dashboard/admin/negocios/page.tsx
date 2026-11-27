"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import Campo from "@/components/campo";
import { useToast } from "@/components/toast";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import {
  consultaDeNegocios,
  ESTADOS_SUCURSAL,
  type EstadoSucursal,
  nombreDeNegocio,
  rutaDeCitasDe,
} from "@/lib/admin-listas";
import { useLanguage } from "@/lib/language-context";
import { rutaDePestana } from "@/lib/pestanas-admin";

type Sucursal = {
  id: string;
  branch_name: string;
  city: string | null;
  state: string | null;
  validation_status: EstadoSucursal;
  validation_notes: string | null;
  is_primary: boolean;
  verified_at: string | null;
  created_at: string;
};

type Negocio = {
  id: string;
  business_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  is_banned: boolean;
  created_at: string;
  branch_counts: Record<EstadoSucursal, number>;
  branches: Sucursal[];
};

type RespuestaNegocios = {
  businesses: Negocio[];
  summary: { businesses: number; branches: Record<EstadoSucursal, number> };
  pagination: { page: number; pageSize: number; totalFiltered: number; totalPages: number };
};

const TEXTOS = {
  titulo: { es: "Negocios y sucursales", en: "Businesses and branches" },
  descripcion: {
    es: "Todos los salones con sus sucursales. Solo lectura: para aprobar usa Verificaciones; para suspender, Usuarios.",
    en: "Every salon with its branches. Read-only: use Verifications to approve and Users to suspend.",
  },
  negocios: { es: "Negocios", en: "Businesses" },
  buscar: { es: "Buscar", en: "Search" },
  placeholderBuscar: {
    es: "Negocio, dueño, correo, teléfono, sucursal o ciudad",
    en: "Business, owner, email, phone, branch or city",
  },
  estado: { es: "Estado de sucursal", en: "Branch status" },
  todas: { es: "Todas", en: "All" },
  colNegocio: { es: "Negocio", en: "Business" },
  colContacto: { es: "Contacto", en: "Contact" },
  colSucursales: { es: "Sucursales", en: "Branches" },
  colAlta: { es: "Alta", en: "Joined" },
  colAcciones: { es: "Acciones", en: "Actions" },
  suspendido: { es: "Suspendido", en: "Suspended" },
  verSucursales: { es: "Ver sucursales de", en: "Show branches of" },
  ocultarSucursales: { es: "Ocultar sucursales de", en: "Hide branches of" },
  verCitas: { es: "Ver citas", en: "View appointments" },
  verEnUsuarios: { es: "Ver en Usuarios", en: "View in Users" },
  principal: { es: "Principal", en: "Main" },
  sinSucursales: { es: "Este negocio no tiene sucursales.", en: "This business has no branches." },
  notas: { es: "Notas", en: "Notes" },
  cargando: { es: "Cargando negocios...", en: "Loading businesses..." },
  vacio: { es: "No hay negocios para los filtros actuales.", en: "No businesses match the current filters." },
  errorTitulo: { es: "No se pudo cargar", en: "Could not load" },
  errorMensaje: {
    es: "No se pudo cargar la lista de negocios. Intenta de nuevo.",
    en: "Could not load the business list. Please try again.",
  },
  reintentar: { es: "Reintentar", en: "Retry" },
  anterior: { es: "Anterior", en: "Previous" },
  siguiente: { es: "Siguiente", en: "Next" },
  pagina: { es: "Página", en: "Page" },
  de: { es: "de", en: "of" },
  resultados: { es: "negocios", en: "businesses" },
} as const;

const ESTADO: Record<EstadoSucursal, { es: string; en: string; variante: "warning" | "success" | "danger" }> = {
  pending: { es: "Pendiente", en: "Pending", variante: "warning" },
  approved: { es: "Aprobada", en: "Approved", variante: "success" },
  rejected: { es: "Rechazada", en: "Rejected", variante: "danger" },
};

/** Negocios con sus sucursales, para el admin (GET /admin/businesses). Solo lectura. */
export default function NegociosAdminPage() {
  const { language } = useLanguage();
  const { showToast } = useToast();
  const [busqueda, setBusqueda] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");
  const [estado, setEstado] = useState<"all" | EstadoSucursal>("all");
  const [pagina, setPagina] = useState(1);
  const [intento, setIntento] = useState(0);
  const [datos, setDatos] = useState<RespuestaNegocios | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());

  useEffect(() => {
    const temporizador = window.setTimeout(() => setBusquedaAplicada(busqueda.trim()), 250);
    return () => window.clearTimeout(temporizador);
  }, [busqueda]);

  useEffect(() => {
    // Si los filtros cambian antes de que llegue la respuesta, la vieja se ignora
    let vigente = true;
    const query = consultaDeNegocios({ busqueda: busquedaAplicada, estado, pagina });
    void api(`/api/admin/businesses${query ? `?${query}` : ""}`, { cache: "no-store" })
      .then(async (respuesta) => {
        if (!respuesta.ok) throw new Error(String(respuesta.status));
        return (await respuesta.json()) as RespuestaNegocios;
      })
      .then((cuerpo) => {
        if (!vigente) return;
        setDatos(cuerpo);
        setError(false);
      })
      .catch(() => {
        if (!vigente) return;
        setError(true);
        showToast({ type: "error", title: TEXTOS.errorTitulo[language], message: TEXTOS.errorMensaje[language] });
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
    // El idioma solo cambia el texto del toast: no es motivo para volver a pedir la lista
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busquedaAplicada, estado, pagina, intento]);

  const recargar = (cambio: () => void) => {
    setCargando(true);
    cambio();
  };

  const alternar = (id: string) =>
    setAbiertos((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });

  const fecha = (valor: string) =>
    new Date(valor).toLocaleDateString(language === "en" ? "en-US" : "es-MX", { dateStyle: "medium" });

  const resumen = datos?.summary;

  return (
    <div className="space-y-4">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{TEXTOS.negocios[language]}</CardDescription>
            <CardTitle className="text-3xl font-black">{resumen?.businesses ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
        {ESTADOS_SUCURSAL.map((e) => (
          <Card key={e}>
            <CardHeader className="pb-2">
              <CardDescription>
                {TEXTOS.colSucursales[language]} · {ESTADO[e][language]}
              </CardDescription>
              <CardTitle className="text-3xl font-black">{resumen?.branches[e] ?? "—"}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{TEXTOS.titulo[language]}</CardTitle>
          <CardDescription>{TEXTOS.descripcion[language]}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
            <Campo etiqueta={TEXTOS.buscar[language]}>
              <Input
                value={busqueda}
                onChange={(evento) => {
                  const valor = evento.target.value;
                  recargar(() => {
                    setPagina(1);
                    setBusqueda(valor);
                  });
                }}
                placeholder={TEXTOS.placeholderBuscar[language]}
              />
            </Campo>
            <Campo etiqueta={TEXTOS.estado[language]}>
              <select
                value={estado}
                onChange={(evento) => {
                  const valor = evento.target.value as "all" | EstadoSucursal;
                  recargar(() => {
                    setPagina(1);
                    setEstado(valor);
                  });
                }}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
              >
                <option value="all">{TEXTOS.todas[language]}</option>
                {ESTADOS_SUCURSAL.map((e) => (
                  <option key={e} value={e}>
                    {ESTADO[e][language]}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          {error ? (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              <span>{TEXTOS.errorMensaje[language]}</span>
              <Button size="sm" variant="outline" disabled={cargando} onClick={() => recargar(() => setIntento((n) => n + 1))}>
                {TEXTOS.reintentar[language]}
              </Button>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{TEXTOS.colNegocio[language]}</TableHead>
                  <TableHead>{TEXTOS.colContacto[language]}</TableHead>
                  <TableHead>{TEXTOS.colSucursales[language]}</TableHead>
                  <TableHead>{TEXTOS.colAlta[language]}</TableHead>
                  <TableHead>{TEXTOS.colAcciones[language]}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(datos?.businesses ?? []).map((negocio) => {
                  const nombre = nombreDeNegocio(negocio);
                  const abierto = abiertos.has(negocio.id);
                  return (
                    <Fragment key={negocio.id}>
                      <TableRow>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => alternar(negocio.id)}
                            aria-expanded={abierto}
                            aria-label={`${(abierto ? TEXTOS.ocultarSucursales : TEXTOS.verSucursales)[language]} ${nombre}`}
                            className="inline-flex items-center gap-1 rounded text-left font-semibold text-slate-900 hover:underline focus-visible:ring-[3px] focus-visible:ring-indigo-200/70 focus-visible:outline-none"
                          >
                            {abierto ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                            {nombre}
                          </button>
                          {negocio.is_banned ? (
                            <Badge variant="danger" className="ml-2">
                              {TEXTOS.suspendido[language]}
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <p>{negocio.email}</p>
                          {negocio.phone ? <p className="text-xs text-slate-500">{negocio.phone}</p> : null}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {ESTADOS_SUCURSAL.filter((e) => negocio.branch_counts[e] > 0).map((e) => (
                              <Badge key={e} variant={ESTADO[e].variante}>
                                {negocio.branch_counts[e]} {ESTADO[e][language]}
                              </Badge>
                            ))}
                            {negocio.branches.length === 0 ? <span className="text-slate-400">—</span> : null}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{fecha(negocio.created_at)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Link
                              href={rutaDeCitasDe({ id: negocio.id, nombre })}
                              className={buttonVariants({ size: "sm", variant: "outline" })}
                            >
                              {TEXTOS.verCitas[language]}
                            </Link>
                            <Link
                              href={`${rutaDePestana("usuarios")}&buscar=${encodeURIComponent(negocio.email)}`}
                              className={buttonVariants({ size: "sm", variant: "outline" })}
                            >
                              {TEXTOS.verEnUsuarios[language]}
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                      {abierto ? (
                        <TableRow className="bg-slate-50">
                          <TableCell colSpan={5}>
                            {negocio.branches.length === 0 ? (
                              <p className="text-sm text-slate-500">{TEXTOS.sinSucursales[language]}</p>
                            ) : (
                              <ul className="space-y-2">
                                {negocio.branches.map((s) => (
                                  <li
                                    key={s.id}
                                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-white p-3 text-sm"
                                  >
                                    <span className="font-semibold">{s.branch_name}</span>
                                    {s.is_primary ? <Badge variant="secondary">{TEXTOS.principal[language]}</Badge> : null}
                                    <Badge variant={ESTADO[s.validation_status].variante}>
                                      {ESTADO[s.validation_status][language]}
                                    </Badge>
                                    <span className="text-slate-500">
                                      {[s.city, s.state].filter(Boolean).join(", ") || "—"}
                                    </span>
                                    {s.validation_notes ? (
                                      <span className="w-full text-xs text-slate-500">
                                        {TEXTOS.notas[language]}: {s.validation_notes}
                                      </span>
                                    ) : null}
                                    <Link
                                      href={rutaDeCitasDe({ id: negocio.id, nombre }, { id: s.id, nombre: s.branch_name })}
                                      className="ml-auto text-xs font-semibold text-indigo-700 hover:underline"
                                    >
                                      {TEXTOS.verCitas[language]}
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {cargando ? <p className="text-sm text-slate-500">{TEXTOS.cargando[language]}</p> : null}
          {!cargando && !error && datos?.businesses.length === 0 ? (
            <p className="text-sm text-slate-500">{TEXTOS.vacio[language]}</p>
          ) : null}

          {datos ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-500">
                {datos.pagination.totalFiltered} {TEXTOS.resultados[language]} · {TEXTOS.pagina[language]}{" "}
                {datos.pagination.page} {TEXTOS.de[language]} {datos.pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={cargando || datos.pagination.page <= 1}
                  onClick={() => recargar(() => setPagina(datos.pagination.page - 1))}
                >
                  {TEXTOS.anterior[language]}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={cargando || datos.pagination.page >= datos.pagination.totalPages}
                  onClick={() => recargar(() => setPagina(datos.pagination.page + 1))}
                >
                  {TEXTOS.siguiente[language]}
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
