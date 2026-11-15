"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import ConfirmarEliminar from "@/components/confirmar-eliminar";
import HorarioSemanal from "@/components/horario-semanal";
import { useToast } from "@/components/toast";
import { useLanguage } from "@/lib/language-context";
import { abrirArchivoPrivado, api, urlArchivo } from "@/lib/api";
import { diasInvalidos, horarioAnterior, horarioPorOmision, leerHorario, resumenHorario, type DiaHorario } from "@/lib/horario";
import { aplicarDireccion, coordenadasValidas, leerJson, mensajeErrorUbicacion, obtenerPosicion } from "@/lib/ubicacion";

type Branch = {
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
  ownership_proof_url: string | null;
  validation_status: "pending" | "approved" | "rejected";
  validation_notes: string | null;
  verified_at: string | null;
  opening_hours: string | null;
  closing_hours: string | null;
  weekly_hours: unknown;
  is_primary: boolean;
};

export default function NegocioSucursalesPage() {
  const { showToast } = useToast();
  const { language, t } = useLanguage();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  /** Horario semanal de la sucursal nueva (decisión de producto: informativo; por omisión L–V 9–20, S 9–16, D cerrado). */
  const [weeklyHours, setWeeklyHours] = useState<DiaHorario[]>(horarioPorOmision);
  /** «Editar horario» de una tarjeta: se edita dentro de la tarjeta (sin modal) y se guarda solo el horario. */
  const [editandoHorario, setEditandoHorario] = useState<{ id: string; horario: DiaHorario[] } | null>(null);
  const [guardandoHorario, setGuardandoHorario] = useState(false);
  /** Sucursal en confirmación de borrado y lo que quedaría sin sucursal (null mientras se cuenta o si falló). */
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [dependientes, setDependientes] = useState<{ id: string; servicios: number; estilistas: number } | { id: string; error: true } | null>(null);
  /** Línea de estado de la ubicación: queda visible (no desaparece como un toast) hasta la siguiente acción. */
  const [estadoUbicacion, setEstadoUbicacion] = useState<{ tipo: "cargando" | "error" | "exito"; texto: string } | null>(null);
  const [branchImageFile, setBranchImageFile] = useState<File | null>(null);
  const [ownershipProofFile, setOwnershipProofFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    branchName: "",
    description: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    latitude: "",
    longitude: "",
    phone: "",
    website: "",
    imageUrl: "",
    isPrimary: false,
  });

  const loadBranches = async () => {
    const response = await api("/api/business/branches", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { branches: Branch[] };
    setBranches(payload.branches ?? []);
  };

  useEffect(() => {
    void loadBranches();
  }, []);

  const en = language === "en";

  /** Busca la dirección de unas coordenadas y la pone en el formulario. Devuelve el error, o null si llenó algo. */
  const resolveAddressFromCoordinates = async (latitude: number, longitude: number): Promise<string | null> => {
    setIsResolvingAddress(true);
    setEstadoUbicacion({ tipo: "cargando", texto: en ? "Looking up the address..." : "Buscando la dirección..." });
    try {
      const response = await api(`/api/geocode/reverse?lat=${latitude}&lng=${longitude}`, { method: "GET", cache: "no-store" });
      const datos = await leerJson(response);
      if (!response.ok) {
        return typeof datos.error === "string" && datos.error ? datos.error : en ? "Could not get the address." : "No se pudo obtener la dirección.";
      }
      // Un 200 sin ningún dato no es éxito: no hay nada que llenar.
      if (aplicarDireccion(form, datos).llenados === 0) {
        return en ? "We could not find an address for those coordinates." : "No encontramos una dirección para esas coordenadas.";
      }
      setForm((current) => aplicarDireccion(current, datos).form);
      return null;
    } catch {
      return en ? "Could not reach the server to get the address." : "No se pudo contactar al servidor para obtener la dirección.";
    } finally {
      setIsResolvingAddress(false);
    }
  };

  const avisar = (tipo: "error" | "exito", texto: string) => {
    setEstadoUbicacion({ tipo, texto });
    showToast({
      type: tipo === "exito" ? "success" : "error",
      title: tipo === "exito" ? (en ? "Location updated" : "Ubicación actualizada") : en ? "Location" : "Ubicación",
      message: texto,
    });
  };

  /** Solo al pulsar "Actualizar ubicación" (decisión de producto: la página no pide la ubicación al abrirse). */
  const requestCurrentLocation = async () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      avisar("error", en ? "Your browser does not support geolocation. Enter the coordinates manually." : "Tu navegador no soporta geolocalización. Escribe las coordenadas a mano.");
      return;
    }

    setIsLocating(true);
    setEstadoUbicacion({ tipo: "cargando", texto: en ? "Detecting your location..." : "Detectando tu ubicación..." });
    let position: GeolocationPosition;
    try {
      position = await obtenerPosicion(navigator.geolocation);
    } catch (error) {
      setIsLocating(false);
      avisar("error", mensajeErrorUbicacion((error as GeolocationPositionError | undefined)?.code, window.isSecureContext, language));
      return;
    }
    setIsLocating(false);

    const latitude = position.coords.latitude.toFixed(8);
    const longitude = position.coords.longitude.toFixed(8);
    setForm((current) => ({ ...current, latitude, longitude }));

    const error = await resolveAddressFromCoordinates(Number(latitude), Number(longitude));
    if (error) {
      avisar("error", en ? `Latitude and longitude were filled, but: ${error}` : `Se llenaron latitud y longitud, pero: ${error}`);
    } else {
      avisar("exito", en ? "Latitude, longitude and address were filled." : "Se llenaron latitud, longitud y dirección.");
    }
  };

  const autocompleteAddress = async () => {
    const coordenadas = coordenadasValidas(form.latitude, form.longitude);
    if (!coordenadas) {
      avisar(
        "error",
        en
          ? "Enter a valid latitude (-90 to 90) and longitude (-180 to 180), or press Update location."
          : "Escribe una latitud (-90 a 90) y longitud (-180 a 180) válidas, o pulsa Actualizar ubicación.",
      );
      return;
    }
    const error = await resolveAddressFromCoordinates(coordenadas.latitude, coordenadas.longitude);
    if (error) avisar("error", error);
    else avisar("exito", en ? "The address was filled from the coordinates." : "Se llenó la dirección con las coordenadas.");
  };

  const remaining = useMemo(() => Math.max(0, 3 - branches.length), [branches.length]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (branches.length >= 3) {
      showToast({
        type: "error",
        title: language === "en" ? "Limit reached" : "Límite alcanzado",
        message: language === "en" ? "You can only register up to 3 branches." : "Solo puedes registrar hasta 3 sucursales.",
      });
      return;
    }

    if (diasInvalidos(weeklyHours).length > 0) {
      showToast({
        type: "error",
        title: language === "en" ? "Check the hours" : "Revisa el horario",
        message: language === "en" ? "On each open day, opening must be before closing." : "En cada día abierto, la apertura debe ser antes del cierre.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await api("/api/business/branches", {
        method: "POST",
        body: (() => {
          const payload = new FormData();
          payload.append("branchName", form.branchName);
          payload.append("description", form.description);
          payload.append("address", form.address);
          payload.append("city", form.city);
          payload.append("state", form.state);
          payload.append("postalCode", form.postalCode);
          payload.append("latitude", form.latitude);
          payload.append("longitude", form.longitude);
          payload.append("phone", form.phone);
          payload.append("website", form.website);
          payload.append("imageUrl", form.imageUrl);
          payload.append("weeklyHours", JSON.stringify(weeklyHours));
          payload.append("isPrimary", form.isPrimary ? "true" : "false");

          if (branchImageFile) {
            payload.append("branchImage", branchImageFile);
          }

          if (ownershipProofFile) {
            payload.append("ownershipProof", ownershipProofFile);
          }

          return payload;
        })(),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? t("business.branches.errorAdd"));
      }

      showToast({
        type: "success",
        title: t("business.branches.successAdd"),
        message: language === "en" ? "Branch registered successfully." : "La sucursal se registró correctamente.",
      });

      setForm({
        branchName: "",
        description: "",
        address: "",
        city: "",
        state: "",
        postalCode: "",
        latitude: "",
        longitude: "",
        phone: "",
        website: "",
        imageUrl: "",
        isPrimary: false,
      });
      setWeeklyHours(horarioPorOmision());
      setBranchImageFile(null);
      setOwnershipProofFile(null);

      await loadBranches();
    } catch (error) {
      showToast({
        type: "error",
        title: t("business.branches.errorAdd"),
        message: error instanceof Error ? error.message : (language === "en" ? "Try again" : "Intenta de nuevo"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const guardarHorario = async () => {
    if (!editandoHorario) return;
    if (diasInvalidos(editandoHorario.horario).length > 0) {
      showToast({
        type: "error",
        title: language === "en" ? "Check the hours" : "Revisa el horario",
        message: language === "en" ? "On each open day, opening must be before closing." : "En cada día abierto, la apertura debe ser antes del cierre.",
      });
      return;
    }
    setGuardandoHorario(true);
    try {
      const response = await api("/api/business/branches/horario", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editandoHorario.id, weeklyHours: editandoHorario.horario }),
      });
      const datos = await leerJson(response);
      if (!response.ok) {
        throw new Error(typeof datos.error === "string" && datos.error ? datos.error : language === "en" ? "Could not save the hours." : "No se pudo guardar el horario.");
      }
      showToast({ type: "success", title: language === "en" ? "Hours saved" : "Horario guardado" });
      setEditandoHorario(null);
      await loadBranches();
    } catch (error) {
      showToast({
        type: "error",
        title: language === "en" ? "Could not save the hours" : "No se pudo guardar el horario",
        message: error instanceof Error ? error.message : language === "en" ? "Try again" : "Intenta de nuevo",
      });
    } finally {
      setGuardandoHorario(false);
    }
  };

  /** Abre la confirmación y cuenta los servicios y estilistas de la sucursal (quedarán sin sucursal al borrarla). */
  const pedirConfirmacion = async (id: string) => {
    setConfirmando(id);
    setDependientes(null);
    try {
      const pedirLista = async (ruta: string) => {
        const response = await api(ruta, { cache: "no-store" });
        if (!response.ok) throw new Error(String(response.status));
        return leerJson(response);
      };
      const [servicios, estilistas] = await Promise.all([pedirLista("/api/business/services"), pedirLista("/api/business/stylists")]);
      const deLaSucursal = (lista: unknown) => (Array.isArray(lista) ? lista.filter((x) => (x as { branch_id?: string }).branch_id === id).length : 0);
      setDependientes({ id, servicios: deLaSucursal(servicios.services), estilistas: deLaSucursal(estilistas.stylists) });
    } catch {
      setDependientes({ id, error: true });
    }
  };

  const avisoDeSucursal = () => {
    const en = language === "en";
    // Solo cuenta lo de la sucursal en confirmación (si se abrieron dos seguidas, la respuesta vieja no vale)
    if (!dependientes || dependientes.id !== confirmando) return en ? "Checking what depends on this branch..." : "Revisando qué depende de esta sucursal...";
    if ("error" in dependientes) {
      return en
        ? "We couldn't check its services and stylists; if it has any, they will be left without a branch."
        : "No pudimos revisar sus servicios y estilistas; si tiene, quedarán sin sucursal.";
    }
    const { servicios, estilistas } = dependientes;
    if (servicios === 0 && estilistas === 0) return en ? "It has no services or stylists." : "No tiene servicios ni estilistas.";
    const partes = [
      servicios > 0 ? (en ? `${servicios} service${servicios === 1 ? "" : "s"}` : `${servicios} servicio${servicios === 1 ? "" : "s"}`) : null,
      estilistas > 0 ? (en ? `${estilistas} stylist${estilistas === 1 ? "" : "s"}` : `${estilistas} estilista${estilistas === 1 ? "" : "s"}`) : null,
    ].filter(Boolean);
    const lista = partes.join(en ? " and " : " y ");
    return en
      ? `Its ${lista} will be left without a branch and will no longer be visible to clients.`
      : `Sus ${lista} quedarán sin sucursal y dejarán de verse para los clientes.`;
  };

  const handleDelete = async (id: string): Promise<boolean> => {
    const response = await api("/api/business/branches", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      showToast({
        type: "error",
        title: t("business.branches.errorDelete"),
        message: payload.error ?? (language === "en" ? "Try again" : "Intenta de nuevo"),
      });
      return false;
    }

    showToast({
      type: "success",
      title: t("business.branches.successDelete"),
    });

    await loadBranches();
    return true;
  };

  return (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <article className="@container min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 @xs:flex-row @xs:items-start @xs:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{t("business.branches")}</p>
            <h2 className="mt-2 text-2xl font-black text-[#151138]">{language === "en" ? "Branch registration" : "Alta de sucursal"}</h2>
          </div>
          <div className="self-start rounded-2xl bg-emerald-50 px-4 py-3 @xs:shrink-0 @xs:text-right">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">{language === "en" ? "Available" : "Disponibles"}</p>
            <p className="text-2xl font-black text-emerald-900">{remaining}</p>
          </div>
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <input
            value={form.branchName}
            onChange={(event) => setForm((current) => ({ ...current, branchName: event.target.value }))}
            placeholder={language === "en" ? "Branch name" : "Nombre de la sucursal"}
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-emerald-300 focus:ring"
          />

          <textarea
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            rows={3}
            placeholder={language === "en" ? "Brief description" : "Descripción breve"}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none ring-emerald-300 focus:ring"
          />

          <input
            value={form.address}
            onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
            placeholder={language === "en" ? "Address" : "Dirección"}
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-emerald-300 focus:ring"
          />

          <div className="grid gap-3 @sm:grid-cols-2 @lg:grid-cols-3">
            <input
              value={form.city}
              onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
              placeholder={language === "en" ? "City" : "Ciudad"}
              className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-emerald-300 focus:ring"
            />
            <input
              value={form.state}
              onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))}
              placeholder={language === "en" ? "State" : "Estado"}
              className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-emerald-300 focus:ring"
            />
            <input
              value={form.postalCode}
              onChange={(event) => setForm((current) => ({ ...current, postalCode: event.target.value }))}
              placeholder={language === "en" ? "ZIP" : "CP"}
              className="h-11 w-full min-w-0 @sm:col-span-2 @lg:col-span-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-emerald-300 focus:ring"
            />
          </div>

          <div className="grid gap-3 @sm:grid-cols-2">
            <input
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              placeholder={language === "en" ? "Phone" : "Teléfono"}
              className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-emerald-300 focus:ring"
            />
            <input
              value={form.website}
              onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))}
              placeholder={language === "en" ? "Website" : "Sitio web"}
              className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-emerald-300 focus:ring"
            />
          </div>

          <div className="grid gap-3 @sm:grid-cols-2">
            <input
              value={form.latitude}
              onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value }))}
              placeholder={language === "en" ? "Latitude" : "Latitud"}
              className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-emerald-300 focus:ring"
            />
            <input
              value={form.longitude}
              onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value }))}
              placeholder={language === "en" ? "Longitude" : "Longitud"}
              className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-emerald-300 focus:ring"
            />
          </div>

          <div className="space-y-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-800">
            <div className="flex flex-col gap-3 @lg:flex-row @lg:items-center @lg:justify-between">
              <p className="min-w-0">
                {en
                  ? "Press Update location to fill latitude, longitude and address. You can edit them if needed."
                  : "Pulsa Actualizar ubicación para llenar latitud, longitud y dirección. Puedes corregirlas si hace falta."}
              </p>
              <div className="grid gap-2 @sm:flex @sm:flex-wrap @lg:shrink-0">
                <button
                  type="button"
                  onClick={() => void requestCurrentLocation()}
                  disabled={isLocating || isResolvingAddress}
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isLocating ? (en ? "Detecting..." : "Detectando...") : en ? "Update location" : "Actualizar ubicación"}
                </button>
                <button
                  type="button"
                  onClick={() => void autocompleteAddress()}
                  disabled={isLocating || isResolvingAddress}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-emerald-300 bg-white px-3 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isResolvingAddress ? (en ? "Autocompleting..." : "Autocompletando...") : en ? "Autocomplete address" : "Autocompletar dirección"}
                </button>
              </div>
            </div>
            <p
              role="status"
              aria-live="polite"
              data-estado-ubicacion={estadoUbicacion?.tipo ?? "vacio"}
              className={
                estadoUbicacion?.tipo === "error"
                  ? "rounded-lg bg-red-50 px-2 py-1 font-medium text-red-700"
                  : estadoUbicacion?.tipo === "exito"
                    ? "rounded-lg bg-white px-2 py-1 font-medium text-emerald-800"
                    : estadoUbicacion
                      ? "px-2 py-1 text-slate-600"
                      : "sr-only"
              }
            >
              {estadoUbicacion?.texto ?? ""}
            </p>
          </div>

          <HorarioSemanal valor={weeklyHours} onChange={setWeeklyHours} idioma={language} />

          <input
            value={form.imageUrl}
            onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))}
            placeholder={language === "en" ? "Image URL starting with https:// (optional, if you don't upload a file)" : "URL de imagen con https:// (opcional, si no subes archivo)"}
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-emerald-300 focus:ring"
          />

          <p className="text-xs text-slate-500">
            {language === "en"
              ? "Image: JPG, PNG or WebP. Ownership proof: PDF or image. Up to 4 MB each. Only you and the administration can see the proof."
              : "Imagen: JPG, PNG o WebP. Comprobante: PDF o imagen. Hasta 4 MB cada uno. El comprobante solo lo ven tú y la administración."}
          </p>

          <div className="grid gap-3 @sm:grid-cols-2">
            {[
              {
                etiqueta: en ? "Branch image" : "Imagen sucursal",
                accept: "image/jpeg,image/png,image/webp",
                archivo: branchImageFile,
                elegir: setBranchImageFile,
                required: false,
              },
              {
                etiqueta: en ? "Ownership proof *" : "Comprobante de propiedad *",
                accept: "application/pdf,image/jpeg,image/png,image/webp",
                archivo: ownershipProofFile,
                elegir: setOwnershipProofFile,
                required: true,
              },
            ].map((campo) => (
              <label key={campo.etiqueta} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide wrap-break-word text-slate-500">{campo.etiqueta}</span>
                {/* El texto nativo ("Ningún archivo seleccionado") se oculta porque el navegador lo corta; el nombre va abajo. */}
                <input
                  type="file"
                  accept={campo.accept}
                  onChange={(event) => campo.elegir(event.target.files?.[0] ?? null)}
                  className="block w-full min-w-0 text-xs text-transparent file:mr-0 file:cursor-pointer file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-emerald-700"
                  required={campo.required}
                />
                <span data-archivo-elegido className="mt-1 block truncate text-xs text-slate-600" title={campo.archivo?.name ?? undefined}>
                  {campo.archivo?.name ?? (en ? "No file chosen" : "Ningún archivo seleccionado")}
                </span>
              </label>
            ))}
          </div>

          <div className="flex flex-col gap-4 border-t border-slate-100 pt-4 @md:flex-row @md:items-center @md:justify-between">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={form.isPrimary}
                onChange={(event) => setForm((current) => ({ ...current, isPrimary: event.target.checked }))}
                className="h-4 w-4 shrink-0"
              />
              {en ? "Mark as primary branch" : "Marcar como sucursal principal"}
            </label>

            <button
              type="submit"
              disabled={isSubmitting || branches.length >= 3}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70 @md:w-auto"
            >
              {branches.length >= 3
                ? en
                  ? "3-branch limit reached"
                  : "Límite de 3 alcanzado"
                : isSubmitting
                  ? en
                    ? "Saving..."
                    : "Guardando..."
                  : en
                    ? "Save branch"
                    : "Guardar sucursal"}
            </button>
          </div>
        </form>
      </article>

      <article className="@container min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{language === "en" ? "List" : "Listado"}</p>
        <h2 className="mt-2 text-2xl font-black text-[#151138]">{language === "en" ? "Your branches" : "Tus sucursales"}</h2>

        <div className="mt-5 space-y-3">
          {branches.map((branch) => (
            <div key={branch.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 @sm:flex-row @sm:items-start @sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 font-semibold wrap-break-word text-slate-800">{branch.branch_name}</p>
                    {branch.is_primary ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                        {language === "en" ? "Primary" : "Principal"}
                      </span>
                    ) : null}
                    <span
                      className={
                        branch.validation_status === "approved"
                          ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700"
                          : branch.validation_status === "rejected"
                            ? "rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700"
                            : "rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700"
                      }
                    >
                      {branch.validation_status === "approved"
                        ? language === "en"
                          ? "Approved"
                          : "Aprobada"
                        : branch.validation_status === "rejected"
                          ? language === "en"
                            ? "Rejected"
                            : "Rechazada"
                          : language === "en"
                            ? "Pending"
                            : "Pendiente"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm wrap-break-word text-slate-600">
                    {branch.address || (language === "en" ? "No address" : "Sin dirección")}
                    {branch.city ? ` · ${branch.city}` : ""}
                  </p>
                  {branch.phone ? <p className="mt-1 text-sm text-slate-500">📱 {branch.phone}</p> : null}
                  {(() => {
                    const horario = leerHorario(branch.weekly_hours);
                    if (horario) {
                      return (
                        <ul data-horario-sucursal className="mt-2 space-y-0.5 text-xs text-slate-600">
                          {resumenHorario(horario, language).map((linea) => (
                            <li key={linea}>🕒 {linea}</li>
                          ))}
                        </ul>
                      );
                    }
                    const anterior = horarioAnterior(branch.opening_hours, branch.closing_hours);
                    return anterior ? (
                      <p data-horario-anterior className="mt-2 text-xs text-slate-500">
                        🕒 {language === "en" ? "Previous hours:" : "Horario anterior:"} {anterior}
                      </p>
                    ) : null;
                  })()}
                  {branch.validation_notes ? (
                    <p className="mt-1 text-xs text-slate-500">{language === "en" ? "Notes:" : "Notas:"} {branch.validation_notes}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setEditandoHorario(
                          editandoHorario?.id === branch.id ? null : { id: branch.id, horario: leerHorario(branch.weekly_hours) ?? horarioPorOmision() },
                        )
                      }
                      aria-expanded={editandoHorario?.id === branch.id}
                      className="rounded-lg border border-emerald-300 bg-white px-2 py-1 text-[11px] font-semibold text-emerald-800"
                    >
                      {language === "en" ? "Edit hours" : "Editar horario"}
                    </button>
                    {branch.image_url ? (
                      <a
                        href={urlArchivo(branch.image_url)}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700"
                      >
                        {language === "en" ? "View image" : "Ver imagen"}
                      </a>
                    ) : null}
                    {branch.ownership_proof_url ? (
                      <button
                        type="button"
                        onClick={() => {
                          const url = branch.ownership_proof_url;
                          if (url) void abrirArchivoPrivado(url).catch(() => alert(language === "en" ? "Could not open the proof." : "No se pudo abrir el comprobante."));
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700"
                      >
                        {language === "en" ? "View proof" : "Ver comprobante"}
                      </button>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void pedirConfirmacion(branch.id)}
                  className="self-start rounded-lg bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-200 @sm:shrink-0"
                >
                  {language === "en" ? "Delete" : "Eliminar"}
                </button>
              </div>
              {confirmando === branch.id ? (
                <ConfirmarEliminar
                  nombre={branch.branch_name}
                  aviso={avisoDeSucursal()}
                  idioma={language}
                  onCancelar={() => setConfirmando(null)}
                  onConfirmar={async () => {
                    if (await handleDelete(branch.id)) setConfirmando(null);
                  }}
                />
              ) : null}
              {editandoHorario?.id === branch.id ? (
                <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
                  <HorarioSemanal
                    valor={editandoHorario.horario}
                    onChange={(horario) => setEditandoHorario({ id: branch.id, horario })}
                    idioma={language}
                  />
                  <div className="flex flex-col gap-2 @sm:flex-row @sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setEditandoHorario(null)}
                      disabled={guardandoHorario}
                      className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-70"
                    >
                      {language === "en" ? "Cancel" : "Cancelar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void guardarHorario()}
                      disabled={guardandoHorario}
                      className="h-10 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {guardandoHorario ? (language === "en" ? "Saving..." : "Guardando...") : language === "en" ? "Save hours" : "Guardar horario"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}

          {branches.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
              {language === "en" ? "You haven't registered branches yet." : "Todavía no registras sucursales."}
            </p>
          ) : null}
        </div>
      </article>
    </section>
  );
}
