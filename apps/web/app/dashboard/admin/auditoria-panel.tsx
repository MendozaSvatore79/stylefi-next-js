"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";

type RegistroAuditoria = {
  id: string;
  admin_email: string;
  action: "delete" | "ban" | "unban";
  target_user_id: string;
  target_email_masked: string;
  target_account_type: string;
  result: "ok" | "bloqueado" | "error";
  detail: Record<string, unknown> | null;
  created_at: string;
};

type PaginaAuditoria = {
  records: RegistroAuditoria[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const ETIQUETAS_DETALLE: Record<string, string> = {
  motivo: "Motivo",
  historial: "Historial",
  origen: "Origen",
  citas: "Citas",
  desglose: "Detalle",
  bloqueo: "Bloqueo",
};

function mostrarDetalle(detalle: RegistroAuditoria["detail"]): string {
  if (!detalle || Object.keys(detalle).length === 0) return "—";
  return Object.entries(detalle)
    .map(([clave, valor]) => {
      const texto = typeof valor === "string" ? valor : JSON.stringify(valor);
      return `${ETIQUETAS_DETALLE[clave] ?? clave}: ${texto}`;
    })
    .join(" · ");
}

function varianteResultado(resultado: RegistroAuditoria["result"]) {
  if (resultado === "ok") return "success";
  if (resultado === "bloqueado") return "warning";
  return "danger";
}

export default function AuditoriaAdminPanel() {
  const [accion, setAccion] = useState("");
  const [resultado, setResultado] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");
  const [pagina, setPagina] = useState<PaginaAuditoria>({
    records: [],
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const prepararCarga = () => {
    setCargando(true);
    setError(null);
  };

  useEffect(() => {
    const temporizador = window.setTimeout(
      () => setBusquedaAplicada(busqueda.trim()),
      250,
    );
    return () => window.clearTimeout(temporizador);
  }, [busqueda]);

  useEffect(() => {
    let vigente = true;
    const params = new URLSearchParams({
      page: String(pagina.page),
      limit: String(pagina.limit),
    });
    if (accion) params.set("accion", accion);
    if (resultado) params.set("resultado", resultado);
    if (busquedaAplicada) params.set("busqueda", busquedaAplicada);

    void api(`/api/admin/audit?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`El servidor respondió ${response.status}.`);
        }
        return (await response.json()) as PaginaAuditoria;
      })
      .then((datos) => {
        if (vigente) setPagina(datos);
      })
      .catch((fallo: unknown) => {
        if (!vigente) return;
        setError(
          fallo instanceof Error
            ? `No se pudo cargar la auditoría. ${fallo.message}`
            : "No se pudo cargar la auditoría. Revisa tu conexión e intenta de nuevo.",
        );
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
  }, [accion, busquedaAplicada, pagina.limit, pagina.page, resultado]);

  const cambiarAccion = (valor: string) => {
    prepararCarga();
    setPagina((actual) => ({ ...actual, page: 1 }));
    setAccion(valor);
  };
  const cambiarResultado = (valor: string) => {
    prepararCarga();
    setPagina((actual) => ({ ...actual, page: 1 }));
    setResultado(valor);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auditoría administrativa</CardTitle>
        <CardDescription>
          Historial de acciones administrativas; los correos afectados se
          muestran enmascarados.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Acción
            <select
              aria-label="Filtrar por acción"
              value={accion}
              onChange={(event) => cambiarAccion(event.target.value)}
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
            >
              <option value="">Todas las acciones</option>
              <option value="delete">delete</option>
              <option value="ban">ban</option>
              <option value="unban">unban</option>
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Resultado
            <select
              aria-label="Filtrar por resultado"
              value={resultado}
              onChange={(event) => cambiarResultado(event.target.value)}
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
            >
              <option value="">Todos los resultados</option>
              <option value="ok">ok</option>
              <option value="bloqueado">bloqueado</option>
              <option value="error">error</option>
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Buscar por correo
            <Input
              value={busqueda}
              onChange={(event) => {
                prepararCarga();
                setPagina((actual) => ({ ...actual, page: 1 }));
                setBusqueda(event.target.value);
              }}
              placeholder="Administrador o usuario afectado"
            />
          </label>
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha y hora</TableHead>
                <TableHead>Administrador</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Usuario afectado</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead>Motivo / detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagina.records.map((registro) => (
                <TableRow key={registro.id}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(registro.created_at).toLocaleString("es-MX", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </TableCell>
                  <TableCell>{registro.admin_email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{registro.action}</Badge>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">
                      {registro.target_email_masked}
                    </p>
                    <p className="text-xs text-slate-500">
                      {registro.target_account_type}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={varianteResultado(registro.result)}>
                      {registro.result}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-sm whitespace-normal">
                    {mostrarDetalle(registro.detail)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {cargando ? (
          <p className="text-sm text-slate-500">Cargando auditoría...</p>
        ) : null}
        {!cargando && !error && pagina.records.length === 0 ? (
          <p className="text-sm text-slate-500">
            No hay registros para los filtros actuales.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            {pagina.total} registros · Página {pagina.page} de{" "}
            {pagina.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={cargando || pagina.page <= 1}
              onClick={() => {
                prepararCarga();
                setPagina((actual) => ({ ...actual, page: actual.page - 1 }));
              }}
            >
              Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={cargando || pagina.page >= pagina.totalPages}
              onClick={() => {
                prepararCarga();
                setPagina((actual) => ({ ...actual, page: actual.page + 1 }));
              }}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
