"use client";

import { useEffect, useState, type FormEvent } from "react";

import AsignarSucursal from "@/components/asignar-sucursal";
import ConfirmarEliminar from "@/components/confirmar-eliminar";
import EditarServicio from "@/components/editar-servicio";
import { useToast } from "@/components/toast";
import { useLanguage } from "@/lib/language-context";
import { api } from "@/lib/api";
import { DURACION_MAXIMA, DURACION_MINIMA, errorRango, errorTexto, errorUrl, LIMITES, PRECIO_MAXIMO, primerError } from "@/lib/validacion";
import Campo from "@/components/campo";

type Service = {
  id: string;
  service_name: string;
  description: string | null;
  price: string;
  duration_minutes: number | null;
  image_url: string | null;
  branch_id: string | null;
  branch_name: string | null;
};

type Branch = {
  id: string;
  branch_name: string;
};

export default function NegocioServiciosPage() {
  const { showToast } = useToast();
  const { t, language } = useLanguage();
  const [services, setServices] = useState<Service[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** Tarjeta en confirmación de borrado (en línea, sin modal). */
  const [confirmando, setConfirmando] = useState<string | null>(null);
  /** Edición en línea; una sola cosa abierta a la vez (editar o confirmar borrado). */
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState({
    branchId: "",
    serviceName: "",
    description: "",
    price: "",
    durationMinutes: "",
    imageUrl: "",
  });

  const loadServices = async () => {
    const response = await api("/api/business/services", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { services: Service[] };
    setServices(payload.services ?? []);
  };

  const loadBranches = async () => {
    const response = await api("/api/business/branches", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { branches: Branch[] };
    setBranches(payload.branches ?? []);
  };

  useEffect(() => {
    void loadServices();
    void loadBranches();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Mismos límites y formatos que el backend (lib/validacion.ts)
    const errorDeCampos = primerError(
      errorTexto(form.serviceName, { es: "El nombre del servicio", en: "The service name" }, LIMITES.nombreCorto, language, { obligatorio: true }),
      errorTexto(form.description, { es: "La descripción", en: "The description" }, LIMITES.descripcion, language, { multilinea: true }),
      errorRango(form.price, { es: "El precio", en: "The price" }, 0, PRECIO_MAXIMO, language, { obligatorio: true, minimoExclusivo: true }),
      errorRango(form.durationMinutes, { es: "La duración", en: "The duration" }, DURACION_MINIMA, DURACION_MAXIMA, language, { entero: true }),
      errorUrl(form.imageUrl, { es: "La URL de la imagen", en: "The image URL" }, language, { soloHttps: true }),
    );
    if (errorDeCampos) {
      showToast({ type: "error", title: language === "en" ? "Check the form" : "Revisa el formulario", message: errorDeCampos });
      return;
    }
    setIsSubmitting(true);

    try {
      const response = await api("/api/business/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: form.branchId,
          serviceName: form.serviceName,
          description: form.description,
          price: Number(form.price),
          durationMinutes: Number(form.durationMinutes || 0),
          imageUrl: form.imageUrl,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? t("business.services.errorAdd"));
      }

      showToast({
        type: "success",
        title: t("business.services.successAdd"),
        message: language === "en" ? "Your service was registered successfully." : "Tu servicio se registró correctamente.",
      });

      setForm({
        branchId: "",
        serviceName: "",
        description: "",
        price: "",
        durationMinutes: "",
        imageUrl: "",
      });

      await loadServices();
    } catch (error) {
      showToast({
        type: "error",
        title: t("business.services.errorAdd"),
        message: error instanceof Error ? error.message : (language === "en" ? "Try again" : "Intenta de nuevo"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Asigna sucursal a un servicio que no tiene (PUT existente: se reenvían sus datos actuales). */
  const asignarSucursal = async (service: Service, branchId: string) => {
    try {
      const response = await api("/api/business/services", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: service.id,
          serviceName: service.service_name,
          description: service.description ?? "",
          price: service.price,
          durationMinutes: service.duration_minutes ?? "",
          imageUrl: service.image_url ?? "",
          branchId,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? (language === "en" ? "Try again" : "Intenta de nuevo"));
      }
      showToast({ type: "success", title: language === "en" ? "Branch assigned" : "Sucursal asignada" });
      await loadServices();
    } catch (error) {
      showToast({
        type: "error",
        title: language === "en" ? "Could not assign the branch" : "No se pudo asignar la sucursal",
        message: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleDelete = async (id: string): Promise<string | null> => {
    const response = await api("/api/business/services", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    if (!response.ok) {
      // El mensaje (por ejemplo, el 409 con las citas próximas) se muestra en la confirmación, que queda abierta
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      return payload.error ?? (language === "en" ? "Could not delete. Try again." : "No se pudo eliminar. Intenta de nuevo.");
    }

    showToast({
      type: "success",
      title: t("business.services.successDelete"),
    });

    await loadServices();
    return null;
  };

  return (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <article className="@container min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{language === "en" ? "Catalog" : "Catálogo"}</p>
        <h2 className="mt-2 text-2xl font-black text-[#151138]">{language === "en" ? "Create service" : "Crear servicio"}</h2>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <Campo etiqueta={language === "en" ? "Branch" : "Sucursal"}>
            <select
              value={form.branchId}
              onChange={(event) => setForm((current) => ({ ...current, branchId: event.target.value }))}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-emerald-300 focus:ring"
            >
              <option value="">{language === "en" ? "Select a branch" : "Selecciona una sucursal"}</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.branch_name}
                </option>
              ))}
            </select>
          </Campo>
          <p className="-mt-2 text-xs text-slate-500">
            {language === "en"
              ? "Each service belongs to one branch. If you have several, create it in each one."
              : "Cada servicio pertenece a una sucursal. Si tienes varias, créalo en cada una."}
          </p>

          <Campo etiqueta={language === "en" ? "Service name" : "Nombre del servicio"}>
            <input
              value={form.serviceName}
              onChange={(event) => setForm((current) => ({ ...current, serviceName: event.target.value }))}
              maxLength={LIMITES.nombreCorto}
              placeholder={language === "en" ? "Service name" : "Nombre del servicio"}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-emerald-300 focus:ring"
            />
          </Campo>

          <Campo etiqueta={language === "en" ? "Description" : "Descripción"}>
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              rows={3}
              maxLength={LIMITES.descripcion}
              placeholder={language === "en" ? "Description" : "Descripción"}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none ring-emerald-300 focus:ring"
            />
          </Campo>

          <div className="grid gap-3 @sm:grid-cols-2">
            <Campo etiqueta={language === "en" ? "Price" : "Precio"}>
              <input
                type="number"
                min="0.01"
                max={PRECIO_MAXIMO}
                step="0.01"
                value={form.price}
                onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
                placeholder={language === "en" ? "Price" : "Precio"}
                className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-emerald-300 focus:ring"
              />
            </Campo>
            <Campo etiqueta={language === "en" ? "Duration (min)" : "Duración (min)"}>
              <input
                type="number"
                min={DURACION_MINIMA}
                max={DURACION_MAXIMA}
                step="1"
                value={form.durationMinutes}
                onChange={(event) => setForm((current) => ({ ...current, durationMinutes: event.target.value }))}
                placeholder={language === "en" ? "Duration (min)" : "Duración (min)"}
                className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-emerald-300 focus:ring"
              />
            </Campo>
          </div>

          <Campo etiqueta={language === "en" ? "Image URL (optional)" : "URL de imagen (opcional)"}>
            <input
              value={form.imageUrl}
              onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))}
              maxLength={LIMITES.url}
              placeholder={language === "en" ? "Image URL (optional)" : "URL de imagen (opcional)"}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-emerald-300 focus:ring"
            />
          </Campo>

          <button
            type="submit"
            disabled={isSubmitting || branches.length === 0 || !form.branchId}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70 @md:w-auto"
          >
            {isSubmitting ? (language === "en" ? "Saving..." : "Guardando...") : (language === "en" ? "Save service" : "Guardar servicio")}
          </button>
        </form>
      </article>

      <article className="@container min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{t("business.services")}</p>
        <h2 className="mt-2 text-2xl font-black text-[#151138]">{language === "en" ? "Your catalog" : "Tu catálogo"}</h2>

        <div className="mt-5 space-y-3">
          {services.map((service) => (
            <div key={service.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 @sm:flex-row @sm:items-start @sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800">{service.service_name}</p>
                  {service.description ? <p className="mt-1 text-sm text-slate-600">{service.description}</p> : null}
                  {service.branch_id ? (
                    <p className="mt-1 text-xs font-medium text-indigo-600">
                      {language === "en" ? "Branch:" : "Sucursal:"} {service.branch_name}
                    </p>
                  ) : (
                    <AsignarSucursal sucursales={branches} idioma={language} onAsignar={(branchId) => asignarSucursal(service, branchId)} />
                  )}
                  <p className="mt-2 text-sm font-semibold text-emerald-700">${Number(service.price).toFixed(2)}</p>
                  {service.duration_minutes ? (
                    <p className="text-xs text-slate-500">{service.duration_minutes} min</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 self-start @sm:shrink-0 @sm:flex-col @sm:items-end">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmando(null);
                      setEditando(editando === service.id ? null : service.id);
                    }}
                    aria-expanded={editando === service.id}
                    className="rounded-lg bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-200"
                  >
                    {language === "en" ? "Edit" : "Editar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditando(null);
                      setConfirmando(service.id);
                    }}
                    className="rounded-lg bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-200"
                  >
                    {language === "en" ? "Delete" : "Eliminar"}
                  </button>
                </div>
              </div>
              {editando === service.id ? (
                <EditarServicio
                  servicio={service}
                  sucursales={branches}
                  idioma={language}
                  onCancelar={() => setEditando(null)}
                  onGuardado={async () => {
                    setEditando(null);
                    await loadServices();
                  }}
                />
              ) : null}
              {confirmando === service.id ? (
                <ConfirmarEliminar
                  nombre={service.service_name}
                  idioma={language}
                  onCancelar={() => setConfirmando(null)}
                  onConfirmar={async () => {
                    const error = await handleDelete(service.id);
                    if (error) return error;
                    setConfirmando(null);
                  }}
                />
              ) : null}
            </div>
          ))}

          {services.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
              {language === "en" ? "You haven't added services yet." : "Aún no has agregado servicios."}
            </p>
          ) : null}

          {branches.length === 0 ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {language === "en"
                ? "First register at least one branch in the branches tab to link services."
                : "Primero registra al menos una sucursal en la pestaña de sucursales para vincular servicios."}
            </p>
          ) : null}
        </div>
      </article>
    </section>
  );
}
