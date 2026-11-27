"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { ESTADOS_CITA, type EstadoCita, etiquetaDeCita, etiquetaEstado, fechaHoraCita } from "@stylefi/shared";

import Campo from "@/components/campo";
import { useToast } from "@/components/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { consultaDeCitas, DIAS_MAXIMOS_CITAS, type ErrorDeRango, rangoInicialDeCitas } from "@/lib/admin-listas";
import { useLanguage } from "@/lib/language-context";


/**
 * Estados para contar y filtrar: los de la cita y dos calculados por el backend para las abiertas cuya hora ya pasó
 * (decisión de producto del 2026-11-25): por cerrar (7 días o menos) y sin confirmar (más de 7).
 */
const ESTADOS_ADMIN = [...ESTADOS_CITA, "por_cerrar", "sin_confirmar"] as const;
type EstadoAdmin = (typeof ESTADOS_ADMIN)[number];

type Cita = {
  id: string;
  scheduled_at: string;
  ends_at: string;
  time_zone: string;
  status: EstadoCita;
  service_name: string;
  total_amount: string;
  business: { id: string; name: string | null };
  branch: { id: string; name: string | null; city: string | null } | null;
  stylist: { id: string; name: string | null } | null;
  client: { id: string; name: string | null; email: string };
};

type RespuestaCitas = {
  appointments: Cita[];
  summary: { total: number; byStatus: Partial<Record<EstadoAdmin, number>> };
  pagination: { page: number; pageSize: number; totalFiltered: number; totalPages: number };
};

const TEXTOS = {
  porCerrar: { es: "Por cerrar", en: "To close" },
  sinConfirmar: { es: "Sin confirmar", en: "Unconfirmed" },
  titulo: { es: "Citas de la plataforma", en: "Platform appointments" },
  descripcion: {
    es: "Citas de todos los salones, en solo lectura. Del cliente solo se muestran el nombre y el correo enmascarado.",
    en: "Appointments across all salons, read-only. Only the client's name and masked email are shown.",
  },
  desde: { es: "Desde", en: "From" },
  hasta: { es: "Hasta (incluido)", en: "To (inclusive)" },
  estado: { es: "Estado", en: "Status" },
  todos: { es: "Todos", en: "All" },
  total: { es: "Citas en el rango", en: "Appointments in range" },
  filtrandoPor: { es: "Filtrando por", en: "Filtering by" },
  quitarFiltro: { es: "Quitar filtro de negocio", en: "Remove business filter" },
  colFecha: { es: "Fecha y hora", en: "Date and time" },
  colServicio: { es: "Servicio", en: "Service" },
  colSalon: { es: "Negocio y sucursal", en: "Business and branch" },
  colProfesional: { es: "Profesional", en: "Professional" },
  colCliente: { es: "Cliente", en: "Client" },
  colEstado: { es: "Estado", en: "Status" },
  colMonto: { es: "Monto", en: "Amount" },
  sinSucursal: { es: "Sin sucursal", en: "No branch" },
  sinAsignar: { es: "Sin asignar", en: "Unassigned" },
  sinNombre: { es: "Sin nombre", en: "No name" },
  cargando: { es: "Cargando citas...", en: "Loading appointments..." },
  vacio: { es: "No hay citas para los filtros actuales.", en: "No appointments match the current filters." },
  errorTitulo: { es: "No se pudo cargar", en: "Could not load" },
  errorMensaje: {
    es: "No se pudo cargar la lista de citas. Intenta de nuevo.",
    en: "Could not load the appointment list. Please try again.",
  },
  reintentar: { es: "Reintentar", en: "Retry" },
  anterior: { es: "Anterior", en: "Previous" },
  siguiente: { es: "Siguiente", en: "Next" },
  pagina: { es: "Página", en: "Page" },
  de: { es: "de", en: "of" },
  resultados: { es: "citas", en: "appointments" },
} as const;

const ERRORES_DE_RANGO: Record<ErrorDeRango, { es: string; en: string }> = {
  fecha: { es: "Elige las dos fechas.", en: "Choose both dates." },
  orden: { es: "La fecha final no puede ser anterior a la inicial.", en: "The end date cannot be before the start date." },
  rango: {
    es: `El rango no puede pasar de ${DIAS_MAXIMOS_CITAS} días.`,
    en: `The range cannot exceed ${DIAS_MAXIMOS_CITAS} days.`,
  },
};

/** Citas de toda la plataforma para el admin (GET /admin/appointments). Solo lectura. */
export default function CitasAdminPage() {
  const { language } = useLanguage();
  const { showToast } = useToast();
  // Negocio y sucursal llegan por la URL desde la pantalla de Negocios ("Ver citas")
  const parametros = useSearchParams();
  const negocio = parametros.get("negocio");
  const sucursal = parametros.get("sucursal");
  const nombreDelFiltro = [parametros.get("nombre"), parametros.get("nombreSucursal")].filter(Boolean).join(" · ");

  const [rango, setRango] = useState(() => rangoInicialDeCitas(new Date()));
  const [estado, setEstado] = useState<"all" | EstadoAdmin>("all");
  const [pagina, setPagina] = useState(1);
  const [intento, setIntento] = useState(0);
  const [datos, setDatos] = useState<RespuestaCitas | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  const consulta = useMemo(
    () => consultaDeCitas({ desde: rango.desde, hasta: rango.hasta, negocio, sucursal, estado, pagina }),
    [rango, negocio, sucursal, estado, pagina],
  );
  const errorDeRango = "error" in consulta ? consulta.error : null;
  const query = "query" in consulta ? consulta.query : null;

  useEffect(() => {
    // Un rango inválido no se pide: el aviso va junto a las fechas
    if (!query) return;
    // Si los filtros cambian antes de que llegue la respuesta, la vieja se ignora
    let vigente = true;
    void api(`/api/admin/appointments?${query}`, { cache: "no-store" })
      .then(async (respuesta) => {
        if (!respuesta.ok) throw new Error(String(respuesta.status));
        return (await respuesta.json()) as RespuestaCitas;
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
  }, [query, intento]);

  /** Cambia un filtro: vuelve a la primera página y marca la carga (si el rango queda inválido, no hay carga). */
  const cambiar = (cambio: () => void) => {
    setCargando(true);
    setPagina(1);
    cambio();
  };

  const monto = (valor: string) =>
    Number(valor).toLocaleString(language === "en" ? "en-US" : "es-MX", { style: "currency", currency: "MXN" });

  const etiquetaAdmin = (e: EstadoAdmin) =>
    e === "por_cerrar" ? TEXTOS.porCerrar[language] : e === "sin_confirmar" ? TEXTOS.sinConfirmar[language] : etiquetaEstado(e, language);

  return (
    <div className="space-y-4">
      <section className="grid gap-4 sm:grid-cols-4 xl:grid-cols-8">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{TEXTOS.total[language]}</CardDescription>
            <CardTitle className="text-3xl font-black">{datos?.summary.total ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
        {ESTADOS_ADMIN.map((e) => (
          <Card key={e}>
            <CardHeader className="pb-2">
              <CardDescription>{etiquetaAdmin(e)}</CardDescription>
              <CardTitle className="text-3xl font-black">{datos?.summary.byStatus[e] ?? "—"}</CardTitle>
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
          {negocio ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-slate-500">{TEXTOS.filtrandoPor[language]}:</span>
              <Badge variant="secondary" className="gap-1">
                {nombreDelFiltro || negocio}
                <Link
                  href="/dashboard/admin/citas"
                  aria-label={TEXTOS.quitarFiltro[language]}
                  className="rounded hover:text-slate-900"
                  onClick={() => setCargando(true)}
                >
                  <X className="size-3.5" />
                </Link>
              </Badge>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-3">
            <Campo etiqueta={TEXTOS.desde[language]}>
              <Input
                type="date"
                value={rango.desde}
                onChange={(evento) => {
                  const valor = evento.target.value;
                  cambiar(() => setRango((actual) => ({ ...actual, desde: valor })));
                }}
              />
            </Campo>
            <Campo etiqueta={TEXTOS.hasta[language]}>
              <Input
                type="date"
                value={rango.hasta}
                onChange={(evento) => {
                  const valor = evento.target.value;
                  cambiar(() => setRango((actual) => ({ ...actual, hasta: valor })));
                }}
              />
            </Campo>
            <Campo etiqueta={TEXTOS.estado[language]}>
              <select
                value={estado}
                onChange={(evento) => {
                  const valor = evento.target.value as "all" | EstadoAdmin;
                  cambiar(() => setEstado(valor));
                }}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
              >
                <option value="all">{TEXTOS.todos[language]}</option>
                {ESTADOS_ADMIN.map((e) => (
                  <option key={e} value={e}>
                    {etiquetaAdmin(e)}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          {errorDeRango ? (
            <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {ERRORES_DE_RANGO[errorDeRango][language]}
            </p>
          ) : null}

          {error && !errorDeRango ? (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              <span>{TEXTOS.errorMensaje[language]}</span>
              <Button
                size="sm"
                variant="outline"
                disabled={cargando}
                onClick={() => {
                  setCargando(true);
                  setIntento((n) => n + 1);
                }}
              >
                {TEXTOS.reintentar[language]}
              </Button>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{TEXTOS.colFecha[language]}</TableHead>
                  <TableHead>{TEXTOS.colServicio[language]}</TableHead>
                  <TableHead>{TEXTOS.colSalon[language]}</TableHead>
                  <TableHead>{TEXTOS.colProfesional[language]}</TableHead>
                  <TableHead>{TEXTOS.colCliente[language]}</TableHead>
                  <TableHead>{TEXTOS.colEstado[language]}</TableHead>
                  <TableHead className="text-right">{TEXTOS.colMonto[language]}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errorDeRango
                  ? null
                  : (datos?.appointments ?? []).map((cita) => (
                      <TableRow key={cita.id}>
                        <TableCell className="whitespace-nowrap">{fechaHoraCita(cita.scheduled_at, language)}</TableCell>
                        <TableCell>{cita.service_name}</TableCell>
                        <TableCell>
                          <p className="font-medium">{cita.business.name ?? "—"}</p>
                          <p className="text-xs text-slate-500">
                            {cita.branch
                              ? [cita.branch.name, cita.branch.city].filter(Boolean).join(" · ")
                              : TEXTOS.sinSucursal[language]}
                          </p>
                        </TableCell>
                        <TableCell>{cita.stylist?.name ?? TEXTOS.sinAsignar[language]}</TableCell>
                        <TableCell>
                          <p>{cita.client.name ?? TEXTOS.sinNombre[language]}</p>
                          <p className="text-xs text-slate-500">{cita.client.email}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{etiquetaDeCita(cita, language)}</Badge>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">{monto(cita.total_amount)}</TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>

          {cargando && !errorDeRango ? <p className="text-sm text-slate-500">{TEXTOS.cargando[language]}</p> : null}
          {!cargando && !error && !errorDeRango && datos?.appointments.length === 0 ? (
            <p className="text-sm text-slate-500">{TEXTOS.vacio[language]}</p>
          ) : null}

          {datos && !errorDeRango ? (
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
                  onClick={() => {
                    setCargando(true);
                    setPagina(datos.pagination.page - 1);
                  }}
                >
                  {TEXTOS.anterior[language]}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={cargando || datos.pagination.page >= datos.pagination.totalPages}
                  onClick={() => {
                    setCargando(true);
                    setPagina(datos.pagination.page + 1);
                  }}
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
