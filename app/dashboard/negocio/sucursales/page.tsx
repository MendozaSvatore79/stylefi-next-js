"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { useToast } from "@/components/toast";
import { useLanguage } from "@/lib/language-context";

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
  is_primary: boolean;
};

export default function NegocioSucursalesPage() {
  const { showToast } = useToast();
  const { language, t } = useLanguage();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
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
    openingHours: "",
    closingHours: "",
    isPrimary: false,
  });

  const loadBranches = async () => {
    const response = await fetch("/api/business/branches", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { branches: Branch[] };
    setBranches(payload.branches ?? []);
  };

  useEffect(() => {
    void loadBranches();
  }, []);

  const resolveAddressFromCoordinates = useCallback(
    async (latitude: number, longitude: number, showFeedback = false) => {
      setIsResolvingAddress(true);

      try {
        const response = await fetch(`/api/geocode/reverse?lat=${latitude}&lng=${longitude}`, {
          method: "GET",
          cache: "no-store",
        });

        const payload = (await response.json()) as {
          address?: string;
          city?: string;
          state?: string;
          postalCode?: string;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? (language === "en" ? "Could not get address." : "No se pudo obtener la dirección."));
        }

        setForm((current) => ({
          ...current,
          address: payload.address || current.address,
          city: payload.city || current.city,
          state: payload.state || current.state,
          postalCode: payload.postalCode || current.postalCode,
        }));

        if (showFeedback) {
          showToast({
            type: "success",
            title: language === "en" ? "Address updated" : "Dirección actualizada",
            message: language === "en" ? "Address was auto-filled from detected location." : "Se autocompletó la dirección con la ubicación detectada.",
          });
        }
      } catch (error) {
        if (showFeedback) {
          showToast({
            type: "error",
            title: language === "en" ? "Could not autocomplete" : "No se pudo autocompletar",
            message: error instanceof Error ? error.message : (language === "en" ? "You can fill the address manually." : "Puedes llenar la dirección manualmente."),
          });
        }
      } finally {
        setIsResolvingAddress(false);
      }
    },
    [showToast],
  );

  const requestCurrentLocation = useCallback(
    async (showFeedback = false) => {
      if (typeof window === "undefined" || !("geolocation" in navigator)) {
        if (showFeedback) {
          showToast({
            type: "error",
            title: language === "en" ? "Location unavailable" : "Ubicación no disponible",
            message: language === "en" ? "Your browser does not support geolocation." : "Tu navegador no soporta geolocalización.",
          });
        }
        return;
      }

      setIsLocating(true);

      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 0,
          });
        });

        const latitude = position.coords.latitude.toFixed(8);
        const longitude = position.coords.longitude.toFixed(8);
        const numericLatitude = Number(latitude);
        const numericLongitude = Number(longitude);

        setForm((current) => ({
          ...current,
          latitude,
          longitude,
        }));

        void resolveAddressFromCoordinates(numericLatitude, numericLongitude, showFeedback);

        if (showFeedback) {
          showToast({
            type: "success",
            title: language === "en" ? "Location detected" : "Ubicación detectada",
            message: language === "en" ? "Latitude and longitude were filled automatically." : "Se completaron latitud y longitud automáticamente.",
          });
        }
      } catch (error) {
        if (showFeedback) {
          const locationError = error as GeolocationPositionError;
          const message =
            locationError.code === 1
              ? language === "en"
                ? "Enable location permission to autocomplete coordinates."
                : "Activa el permiso de ubicación para autocompletar coordenadas."
              : language === "en"
                ? "Could not get your precise location. You can edit coordinates manually."
                : "No fue posible obtener tu ubicación precisa. Puedes editar las coordenadas manualmente.";

          showToast({
            type: "error",
            title: language === "en" ? "Could not get location" : "No se pudo obtener ubicación",
            message,
          });
        }
      } finally {
        setIsLocating(false);
      }
    },
    [resolveAddressFromCoordinates, showToast],
  );

  useEffect(() => {
    if (!form.latitude && !form.longitude) {
      void requestCurrentLocation(false);
    }
  }, [form.latitude, form.longitude, requestCurrentLocation]);

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

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/business/branches", {
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
          payload.append("openingHours", form.openingHours);
          payload.append("closingHours", form.closingHours);
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
        openingHours: "",
        closingHours: "",
        isPrimary: false,
      });
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

  const handleDelete = async (id: string) => {
    const response = await fetch("/api/business/branches", {
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
      return;
    }

    showToast({
      type: "success",
      title: t("business.branches.successDelete"),
    });

    await loadBranches();
  };

  return (
    <section className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
      <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{t("business.branches")}</p>
            <h2 className="mt-2 text-2xl font-black text-[#151138]">{language === "en" ? "Branch registration" : "Alta de sucursal"}</h2>
          </div>
          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-right">
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

          <div className="grid gap-3 sm:grid-cols-3">
            <input
              value={form.city}
              onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
              placeholder={language === "en" ? "City" : "Ciudad"}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-emerald-300 focus:ring"
            />
            <input
              value={form.state}
              onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))}
              placeholder={language === "en" ? "State" : "Estado"}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-emerald-300 focus:ring"
            />
            <input
              value={form.postalCode}
              onChange={(event) => setForm((current) => ({ ...current, postalCode: event.target.value }))}
              placeholder={language === "en" ? "ZIP" : "CP"}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-emerald-300 focus:ring"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              placeholder={language === "en" ? "Phone" : "Teléfono"}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-emerald-300 focus:ring"
            />
            <input
              value={form.website}
              onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))}
              placeholder={language === "en" ? "Website" : "Sitio web"}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-emerald-300 focus:ring"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={form.latitude}
              onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value }))}
              placeholder={language === "en" ? "Latitude" : "Latitud"}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-emerald-300 focus:ring"
            />
            <input
              value={form.longitude}
              onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value }))}
              placeholder={language === "en" ? "Longitude" : "Longitud"}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-emerald-300 focus:ring"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-800">
            <p>{language === "en" ? "Location is detected automatically. You can edit latitude and longitude if needed." : "La ubicación se detecta automáticamente. Puedes editar latitud y longitud si necesitas corregirla."}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void requestCurrentLocation(true)}
                disabled={isLocating}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLocating ? (language === "en" ? "Detecting..." : "Detectando...") : (language === "en" ? "Update location" : "Actualizar ubicación")}
              </button>
              <button
                type="button"
                onClick={() => {
                  const latitude = Number(form.latitude);
                  const longitude = Number(form.longitude);

                  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                    showToast({
                      type: "error",
                      title: language === "en" ? "Invalid coordinates" : "Coordenadas inválidas",
                      message: language === "en" ? "Enter valid latitude and longitude to autocomplete address." : "Ingresa latitud y longitud válidas para autocompletar la dirección.",
                    });
                    return;
                  }

                  void resolveAddressFromCoordinates(latitude, longitude, true);
                }}
                disabled={isResolvingAddress}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-emerald-300 bg-white px-3 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isResolvingAddress ? (language === "en" ? "Autocompleting..." : "Autocompletando...") : (language === "en" ? "Autocomplete address" : "Autocompletar dirección")}
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={form.openingHours}
              onChange={(event) => setForm((current) => ({ ...current, openingHours: event.target.value }))}
              placeholder={language === "en" ? "Opening time" : "Horario apertura"}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-emerald-300 focus:ring"
            />
            <input
              value={form.closingHours}
              onChange={(event) => setForm((current) => ({ ...current, closingHours: event.target.value }))}
              placeholder={language === "en" ? "Closing time" : "Horario cierre"}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-emerald-300 focus:ring"
            />
          </div>

          <input
            value={form.imageUrl}
            onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))}
            placeholder={language === "en" ? "Image URL (optional, if you don't upload a file)" : "URL imagen (opcional, si no subes archivo)"}
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-emerald-300 focus:ring"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">{language === "en" ? "Branch image" : "Imagen sucursal"}</span>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setBranchImageFile(event.target.files?.[0] ?? null)}
                className="block w-full text-xs text-slate-600"
              />
            </label>

            <label className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">{language === "en" ? "Ownership proof *" : "Comprobante de propiedad *"}</span>
              <input
                type="file"
                accept=".pdf,.doc,.docx,image/*"
                onChange={(event) => setOwnershipProofFile(event.target.files?.[0] ?? null)}
                className="block w-full text-xs text-slate-600"
                required
              />
            </label>
          </div>

          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.isPrimary}
              onChange={(event) => setForm((current) => ({ ...current, isPrimary: event.target.checked }))}
            />
            {language === "en" ? "Mark as primary branch" : "Marcar como sucursal principal"}
          </label>

          <button
            type="submit"
            disabled={isSubmitting || branches.length >= 3}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {branches.length >= 3
              ? language === "en"
                ? "3-branch limit reached"
                : "Límite de 3 alcanzado"
              : isSubmitting
                ? language === "en"
                  ? "Saving..."
                  : "Guardando..."
                : language === "en"
                  ? "Save branch"
                  : "Guardar sucursal"}
          </button>
        </form>
      </article>

      <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{language === "en" ? "List" : "Listado"}</p>
        <h2 className="mt-2 text-2xl font-black text-[#151138]">{language === "en" ? "Your branches" : "Tus sucursales"}</h2>

        <div className="mt-5 space-y-3">
          {branches.map((branch) => (
            <div key={branch.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-800">{branch.branch_name}</p>
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
                  <p className="mt-1 text-sm text-slate-600">
                    {branch.address || (language === "en" ? "No address" : "Sin dirección")}
                    {branch.city ? ` · ${branch.city}` : ""}
                  </p>
                  {branch.phone ? <p className="mt-1 text-sm text-slate-500">📱 {branch.phone}</p> : null}
                  {branch.validation_notes ? (
                    <p className="mt-1 text-xs text-slate-500">{language === "en" ? "Notes:" : "Notas:"} {branch.validation_notes}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {branch.image_url ? (
                      <a
                        href={branch.image_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700"
                      >
                        {language === "en" ? "View image" : "Ver imagen"}
                      </a>
                    ) : null}
                    {branch.ownership_proof_url ? (
                      <a
                        href={branch.ownership_proof_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700"
                      >
                        {language === "en" ? "View proof" : "Ver comprobante"}
                      </a>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(branch.id)}
                  className="rounded-lg bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-200"
                >
                  {language === "en" ? "Delete" : "Eliminar"}
                </button>
              </div>
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
