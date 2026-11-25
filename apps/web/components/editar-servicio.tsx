"use client";

import { useState } from "react";

import { useToast } from "@/components/toast";
import { api } from "@/lib/api";
import { leerJson } from "@/lib/ubicacion";
import { DURACION_MAXIMA, DURACION_MINIMA, errorRango, errorTexto, errorUrl, LIMITES, PRECIO_MAXIMO, primerError } from "@/lib/validacion";

export type ServicioEditable = {
  id: string;
  service_name: string;
  description: string | null;
  price: string;
  duration_minutes: number | null;
  image_url: string | null;
  branch_id: string | null;
};

const campo =
  "h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none ring-emerald-300 focus:ring";

/**
 * Edición en línea de un servicio. Decisión de producto: cambiarlo de sucursal con citas próximas da 409 (el mensaje
 * se muestra aquí y el formulario queda abierto); sin citas, se desvincula de los estilistas de la sucursal anterior.
 */
export default function EditarServicio({
  servicio,
  sucursales,
  idioma,
  onCancelar,
  onGuardado,
}: {
  servicio: ServicioEditable;
  sucursales: Array<{ id: string; branch_name: string }>;
  idioma: "es" | "en";
  onCancelar: () => void;
  onGuardado: () => Promise<void> | void;
}) {
  const en = idioma === "en";
  const { showToast } = useToast();
  const [form, setForm] = useState({
    serviceName: servicio.service_name,
    description: servicio.description ?? "",
    price: String(Number(servicio.price)),
    durationMinutes: servicio.duration_minutes ? String(servicio.duration_minutes) : "",
    imageUrl: servicio.image_url ?? "",
    branchId: servicio.branch_id ?? "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cambiaDeSucursal = Boolean(servicio.branch_id) && form.branchId !== servicio.branch_id;

  const cambiar = (k: keyof typeof form) => (event: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: event.target.value }));

  const guardar = async () => {
    // Datos viejos sin tocar se aceptan como en el backend
    const sinCambio = (k: keyof typeof form, original: string) => form[k].trim() === original;
    const errorDeCampos = primerError(
      sinCambio("serviceName", servicio.service_name)
        ? null
        : errorTexto(form.serviceName, { es: "El nombre del servicio", en: "The service name" }, LIMITES.nombreCorto, idioma, { obligatorio: true }),
      sinCambio("description", servicio.description ?? "")
        ? null
        : errorTexto(form.description, { es: "La descripción", en: "The description" }, LIMITES.descripcion, idioma, { multilinea: true }),
      Number(form.price) === Number(servicio.price)
        ? null
        : errorRango(form.price, { es: "El precio", en: "The price" }, 0, PRECIO_MAXIMO, idioma, { obligatorio: true, minimoExclusivo: true }),
      Number(form.durationMinutes || 0) === (servicio.duration_minutes ?? 0)
        ? null
        : errorRango(form.durationMinutes, { es: "La duración", en: "The duration" }, DURACION_MINIMA, DURACION_MAXIMA, idioma, { entero: true }),
      sinCambio("imageUrl", servicio.image_url ?? "")
        ? null
        : errorUrl(form.imageUrl, { es: "La URL de la imagen", en: "The image URL" }, idioma, { soloHttps: true }),
      form.branchId ? null : en ? "Choose a branch." : "Elige una sucursal.",
    );
    if (errorDeCampos) {
      setError(errorDeCampos);
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      const response = await api("/api/business/services", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: servicio.id, ...form }),
      });
      const cuerpo = await leerJson(response);
      if (!response.ok) {
        // El 409 por citas próximas (u otro error) se queda a la vista
        setError(typeof cuerpo.error === "string" && cuerpo.error ? cuerpo.error : en ? "Could not save the service." : "No se pudo guardar el servicio.");
        return;
      }
      showToast({ type: "success", title: en ? "Service updated" : "Servicio actualizado" });
      await onGuardado();
    } catch {
      setError(en ? "Could not reach the server." : "No se pudo contactar al servidor.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div data-editar-servicio className="mt-3 space-y-2 border-t border-slate-200 pt-3">
      <select value={form.branchId} onChange={cambiar("branchId")} className={campo} aria-label={en ? "Branch" : "Sucursal"}>
        <option value="">{en ? "Select a branch" : "Selecciona una sucursal"}</option>
        {sucursales.map((s) => (
          <option key={s.id} value={s.id}>
            {s.branch_name}
          </option>
        ))}
      </select>
      {cambiaDeSucursal ? (
        <p className="text-xs text-amber-700">
          {en
            ? "It will be removed from the stylists of its current branch. With upcoming appointments it can't be moved."
            : "Se quitará de los estilistas de su sucursal actual. Con citas próximas no se puede cambiar."}
        </p>
      ) : null}
      <input className={campo} value={form.serviceName} onChange={cambiar("serviceName")} maxLength={LIMITES.nombreCorto} placeholder={en ? "Service name" : "Nombre del servicio"} />
      <textarea
        className={`${campo} h-auto py-2`}
        rows={2}
        value={form.description}
        onChange={cambiar("description")}
        maxLength={LIMITES.descripcion}
        placeholder={en ? "Description" : "Descripción"}
      />
      <div className="grid gap-2 @sm:grid-cols-2">
        <input className={campo} type="number" min="0.01" max={PRECIO_MAXIMO} step="0.01" value={form.price} onChange={cambiar("price")} placeholder={en ? "Price" : "Precio"} />
        <input
          className={campo}
          type="number"
          min={DURACION_MINIMA}
          max={DURACION_MAXIMA}
          step="1"
          value={form.durationMinutes}
          onChange={cambiar("durationMinutes")}
          placeholder={en ? "Duration (min)" : "Duración (min)"}
        />
      </div>
      <input className={campo} value={form.imageUrl} onChange={cambiar("imageUrl")} maxLength={LIMITES.url} placeholder={en ? "Image URL (optional)" : "URL de imagen (opcional)"} />
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-800">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 @sm:flex-row @sm:justify-end">
        <button type="button" onClick={onCancelar} disabled={guardando} className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-70">
          {en ? "Cancel" : "Cancelar"}
        </button>
        <button
          type="button"
          onClick={() => void guardar()}
          disabled={guardando}
          className="h-9 rounded-lg bg-emerald-700 px-4 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {guardando ? (en ? "Saving..." : "Guardando...") : en ? "Save changes" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
