"use client";

import { useMemo, useState } from "react";

import { useToast } from "@/components/toast";
import { api } from "@/lib/api";
import { aplicarDireccion, coordenadasValidas, leerJson, mensajeErrorUbicacion, obtenerPosicion } from "@/lib/ubicacion";
import {
  errorCodigoPostal,
  errorTelefono,
  errorTexto,
  errorUrl,
  LIMITES,
  limpiarCodigoPostal,
  limpiarTelefono,
  primerError,
} from "@/lib/validacion";

export type SucursalEditable = {
  id: string;
  branch_name: string;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  latitude: string | null;
  longitude: string | null;
  phone: string | null;
  website: string | null;
  image_url: string | null;
  validation_status: "pending" | "approved" | "rejected";
};

const campo =
  "h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none ring-emerald-300 focus:ring";

/** Coordenada guardada ("19.43260000") contra la escrita: iguales si valen lo mismo. */
function mismaCoordenada(escrita: string, guardada: string | null) {
  const a = escrita.trim();
  if (!a || guardada === null) return !a && guardada === null;
  return Math.abs(Number(a) - Number(guardada)) < 1e-8;
}

/**
 * Edición en línea de una sucursal (dentro de su tarjeta, sin modal). Decisión de producto: solo los datos de
 * identidad (nombre, dirección, ciudad, estado, CP, coordenadas o comprobante nuevo) la regresan a «Pendiente»; el
 * aviso se muestra antes de guardar. Mismos límites que el alta (lib/validacion.ts).
 */
export default function EditarSucursal({
  sucursal,
  idioma,
  onCancelar,
  onGuardada,
}: {
  sucursal: SucursalEditable;
  idioma: "es" | "en";
  onCancelar: () => void;
  onGuardada: () => Promise<void> | void;
}) {
  const en = idioma === "en";
  const { showToast } = useToast();
  const imagenEsUrl = Boolean(sucursal.image_url?.startsWith("https://"));
  const [form, setForm] = useState({
    branchName: sucursal.branch_name,
    description: sucursal.description ?? "",
    address: sucursal.address ?? "",
    city: sucursal.city ?? "",
    state: sucursal.state ?? "",
    postalCode: sucursal.postal_code ?? "",
    latitude: sucursal.latitude ?? "",
    longitude: sucursal.longitude ?? "",
    phone: sucursal.phone ?? "",
    website: sucursal.website ?? "",
    imageUrl: imagenEsUrl ? (sucursal.image_url ?? "") : "",
  });
  const [imagen, setImagen] = useState<File | null>(null);
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [quitarImagen, setQuitarImagen] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [ubicando, setUbicando] = useState(false);
  const [estadoUbicacion, setEstadoUbicacion] = useState<string | null>(null);

  const cambiar = (k: keyof typeof form) => (event: { target: { value: string } }) => {
    const valor = event.target.value;
    setForm((f) => ({
      ...f,
      [k]: k === "phone" ? limpiarTelefono(valor) : k === "postalCode" ? limpiarCodigoPostal(valor) : valor,
    }));
  };

  // Mismo criterio que el backend: ¿estos cambios la regresan a «Pendiente»?
  const revalida = useMemo(
    () =>
      Boolean(comprobante) ||
      form.branchName.trim() !== sucursal.branch_name ||
      (form.address.trim() || null) !== sucursal.address ||
      (form.city.trim() || null) !== sucursal.city ||
      (form.state.trim() || null) !== sucursal.state ||
      (form.postalCode.trim() || null) !== sucursal.postal_code ||
      !mismaCoordenada(form.latitude, sucursal.latitude) ||
      !mismaCoordenada(form.longitude, sucursal.longitude),
    [form, comprobante, sucursal],
  );

  const usarMiUbicacion = async () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setEstadoUbicacion(en ? "Your browser does not support geolocation." : "Tu navegador no soporta geolocalización.");
      return;
    }
    setUbicando(true);
    setEstadoUbicacion(en ? "Detecting your location..." : "Detectando tu ubicación...");
    try {
      const posicion = await obtenerPosicion(navigator.geolocation);
      const latitude = posicion.coords.latitude.toFixed(8);
      const longitude = posicion.coords.longitude.toFixed(8);
      setForm((f) => ({ ...f, latitude, longitude }));
      const response = await api(`/api/geocode/reverse?lat=${latitude}&lng=${longitude}`, { cache: "no-store" });
      const datos = await leerJson(response);
      if (response.ok && aplicarDireccion({ address: "", city: "", state: "", postalCode: "" }, datos).llenados > 0) {
        setForm((f) => {
          const conDireccion = aplicarDireccion(f, datos).form;
          return { ...conDireccion, postalCode: limpiarCodigoPostal(conDireccion.postalCode) };
        });
        setEstadoUbicacion(en ? "Latitude, longitude and address were filled." : "Se llenaron latitud, longitud y dirección.");
      } else {
        const error = typeof datos.error === "string" ? datos.error : en ? "Could not get the address." : "No se pudo obtener la dirección.";
        setEstadoUbicacion(en ? `Coordinates filled, but: ${error}` : `Se llenaron las coordenadas, pero: ${error}`);
      }
    } catch (error) {
      setEstadoUbicacion(mensajeErrorUbicacion((error as GeolocationPositionError | undefined)?.code, window.isSecureContext, idioma));
    } finally {
      setUbicando(false);
    }
  };

  const guardar = async () => {
    const coordenadasEscritas = form.latitude.trim() || form.longitude.trim();
    const errorDeCampos = primerError(
      errorTexto(form.branchName, { es: "El nombre de la sucursal", en: "The branch name" }, LIMITES.nombreCorto, idioma, { obligatorio: true }),
      errorTexto(form.description, { es: "La descripción", en: "The description" }, LIMITES.descripcion, idioma, { multilinea: true }),
      errorTexto(form.address, { es: "La dirección", en: "The address" }, LIMITES.direccion, idioma),
      errorTexto(form.city, { es: "La ciudad", en: "The city" }, LIMITES.ciudad, idioma),
      errorTexto(form.state, { es: "El estado", en: "The state" }, LIMITES.estado, idioma),
      (form.postalCode.trim() || null) === sucursal.postal_code ? null : errorCodigoPostal(form.postalCode, idioma),
      (form.phone.trim() || null) === sucursal.phone ? null : errorTelefono(form.phone, idioma),
      errorUrl(form.website, { es: "El sitio web", en: "The website" }, idioma),
      !quitarImagen && !imagen ? errorUrl(form.imageUrl, { es: "La URL de la imagen", en: "The image URL" }, idioma, { soloHttps: true }) : null,
      coordenadasEscritas && !coordenadasValidas(form.latitude, form.longitude)
        ? en
          ? "Enter a valid latitude (-90 to 90) and longitude (-180 to 180), or leave both empty."
          : "Escribe una latitud (-90 a 90) y longitud (-180 a 180) válidas, o deja las dos vacías."
        : null,
    );
    if (errorDeCampos) {
      showToast({ type: "error", title: en ? "Check the form" : "Revisa el formulario", message: errorDeCampos });
      return;
    }

    // Imagen: quitarla (vacía), archivo nuevo, URL escrita, o la misma de antes (si era un archivo subido)
    const imageUrl = quitarImagen ? "" : form.imageUrl.trim() || (imagenEsUrl ? "" : (sucursal.image_url ?? ""));
    const datos = new FormData();
    datos.append("id", sucursal.id);
    for (const [clave, valor] of Object.entries({ ...form, imageUrl })) datos.append(clave, valor);
    datos.append("isPrimary", "false");
    if (imagen && !quitarImagen) datos.append("branchImage", imagen);
    if (comprobante) datos.append("ownershipProof", comprobante);

    setGuardando(true);
    try {
      const response = await api("/api/business/branches", { method: "PUT", body: datos });
      const cuerpo = await leerJson(response);
      if (!response.ok) {
        throw new Error(typeof cuerpo.error === "string" && cuerpo.error ? cuerpo.error : en ? "Could not save the branch." : "No se pudo guardar la sucursal.");
      }
      showToast({
        type: "success",
        title: en ? "Branch updated" : "Sucursal actualizada",
        message: cuerpo.revalidada
          ? en
            ? "It went back to pending approval."
            : "Volvió a quedar pendiente de aprobación."
          : en
            ? "Its approval status didn't change."
            : "Su estado de aprobación no cambió.",
      });
      await onGuardada();
    } catch (error) {
      showToast({
        type: "error",
        title: en ? "Could not save" : "No se pudo guardar",
        message: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div data-editar-sucursal className="mt-3 space-y-3 border-t border-slate-200 pt-3">
      <input className={campo} value={form.branchName} onChange={cambiar("branchName")} maxLength={LIMITES.nombreCorto} placeholder={en ? "Branch name" : "Nombre de la sucursal"} />
      <textarea
        className={`${campo} h-auto py-2`}
        rows={2}
        value={form.description}
        onChange={cambiar("description")}
        maxLength={LIMITES.descripcion}
        placeholder={en ? "Brief description" : "Descripción breve"}
      />
      <input className={campo} value={form.address} onChange={cambiar("address")} maxLength={LIMITES.direccion} placeholder={en ? "Address" : "Dirección"} />
      <div className="grid gap-2 @sm:grid-cols-2 @lg:grid-cols-3">
        <input className={campo} value={form.city} onChange={cambiar("city")} maxLength={LIMITES.ciudad} placeholder={en ? "City" : "Ciudad"} />
        <input className={campo} value={form.state} onChange={cambiar("state")} maxLength={LIMITES.estado} placeholder={en ? "State" : "Estado"} />
        <input className={`${campo} @sm:col-span-2 @lg:col-span-1`} value={form.postalCode} onChange={cambiar("postalCode")} inputMode="numeric" placeholder={en ? "ZIP" : "CP"} />
      </div>
      <div className="grid gap-2 @sm:grid-cols-2">
        <input className={campo} value={form.latitude} onChange={cambiar("latitude")} placeholder={en ? "Latitude" : "Latitud"} />
        <input className={campo} value={form.longitude} onChange={cambiar("longitude")} placeholder={en ? "Longitude" : "Longitud"} />
      </div>
      <div className="flex flex-col gap-2 @sm:flex-row @sm:items-center">
        <button
          type="button"
          onClick={() => void usarMiUbicacion()}
          disabled={ubicando}
          className="h-9 rounded-lg border border-emerald-300 bg-white px-3 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-70"
        >
          {ubicando ? (en ? "Detecting..." : "Detectando...") : en ? "Update location" : "Actualizar ubicación"}
        </button>
        {estadoUbicacion ? (
          <p role="status" aria-live="polite" className="text-xs text-slate-600">
            {estadoUbicacion}
          </p>
        ) : null}
      </div>
      <div className="grid gap-2 @sm:grid-cols-2">
        <input className={campo} value={form.phone} onChange={cambiar("phone")} inputMode="numeric" autoComplete="tel" placeholder={en ? "Phone (10 digits)" : "Teléfono (10 dígitos)"} />
        <input className={campo} value={form.website} onChange={cambiar("website")} maxLength={LIMITES.url} placeholder={en ? "Website" : "Sitio web"} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{en ? "Image" : "Imagen"}</p>
        {sucursal.image_url && !quitarImagen ? (
          <p className="mt-1 text-xs text-slate-600">
            {imagenEsUrl ? (en ? "Current: image URL" : "Actual: URL de imagen") : en ? "Current: uploaded file" : "Actual: archivo subido"}
          </p>
        ) : null}
        {quitarImagen ? (
          <p className="mt-1 text-xs font-medium text-amber-700">{en ? "The image will be removed when saving." : "La imagen se quitará al guardar."}</p>
        ) : (
          <div className="mt-2 grid gap-2">
            <input className={campo} value={form.imageUrl} onChange={cambiar("imageUrl")} maxLength={LIMITES.url} placeholder={en ? "Image URL starting with https://" : "URL de imagen con https://"} />
            <label className="min-w-0 text-xs text-slate-600">
              <span className="sr-only">{en ? "New image file" : "Archivo de imagen nuevo"}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => setImagen(event.target.files?.[0] ?? null)}
                className="block w-full min-w-0 text-xs text-transparent file:mr-0 file:cursor-pointer file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
              />
              <span className="mt-1 block truncate">{imagen?.name ?? (en ? "No new file" : "Sin archivo nuevo")}</span>
            </label>
          </div>
        )}
        {sucursal.image_url || quitarImagen ? (
          <button
            type="button"
            onClick={() => setQuitarImagen((q) => !q)}
            className="mt-2 rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700"
          >
            {quitarImagen ? (en ? "Keep image" : "Conservar imagen") : en ? "Remove image" : "Quitar imagen"}
          </button>
        ) : null}
      </div>

      <label className="block min-w-0 rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-600">
        <span className="mb-1 block font-semibold uppercase tracking-wide text-slate-500">{en ? "New ownership proof (optional)" : "Comprobante nuevo (opcional)"}</span>
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          onChange={(event) => setComprobante(event.target.files?.[0] ?? null)}
          className="block w-full min-w-0 text-xs text-transparent file:mr-0 file:cursor-pointer file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
        />
        <span className="mt-1 block truncate">{comprobante?.name ?? (en ? "The current one is kept" : "Se conserva el actual")}</span>
      </label>

      {sucursal.validation_status !== "pending" ? (
        <p data-aviso-revalidacion className={`rounded-lg px-3 py-2 text-xs ${revalida ? "bg-amber-50 font-medium text-amber-800" : "bg-slate-50 text-slate-600"}`}>
          {revalida
            ? en
              ? "These changes (name, address, coordinates or proof) will send the branch back to pending approval."
              : "Estos cambios (nombre, dirección, coordenadas o comprobante) regresarán la sucursal a pendiente de aprobación."
            : en
              ? "Phone, website, description and image are saved without losing the approval."
              : "Teléfono, sitio web, descripción e imagen se guardan sin perder la aprobación."}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 @sm:flex-row @sm:justify-end">
        <button
          type="button"
          onClick={onCancelar}
          disabled={guardando}
          className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-70"
        >
          {en ? "Cancel" : "Cancelar"}
        </button>
        <button
          type="button"
          onClick={() => void guardar()}
          disabled={guardando}
          className="h-10 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {guardando ? (en ? "Saving..." : "Guardando...") : en ? "Save changes" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
