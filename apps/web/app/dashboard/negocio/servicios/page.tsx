"use client";

import { useEffect, useState, type FormEvent } from "react";

import { useToast } from "@/components/toast";
import { useLanguage } from "@/lib/language-context";

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
  const [form, setForm] = useState({
    branchId: "",
    serviceName: "",
    description: "",
    price: "",
    durationMinutes: "",
    imageUrl: "",
  });

  const loadServices = async () => {
    const response = await fetch("/api/business/services", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { services: Service[] };
    setServices(payload.services ?? []);
  };

  const loadBranches = async () => {
    const response = await fetch("/api/business/branches", { cache: "no-store" });
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
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/business/services", {
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

  const handleDelete = async (id: string) => {
    const response = await fetch("/api/business/services", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      showToast({
        type: "error",
        title: t("business.services.errorDelete"),
        message: payload.error ?? (language === "en" ? "Try again" : "Intenta de nuevo"),
      });
      return;
    }

    showToast({
      type: "success",
      title: t("business.services.successDelete"),
    });

    await loadServices();
  };

  return (
    <section className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
      <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{language === "en" ? "Catalog" : "Catálogo"}</p>
        <h2 className="mt-2 text-2xl font-black text-[#151138]">{language === "en" ? "Create service" : "Crear servicio"}</h2>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
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

          <input
            value={form.serviceName}
            onChange={(event) => setForm((current) => ({ ...current, serviceName: event.target.value }))}
            placeholder={language === "en" ? "Service name" : "Nombre del servicio"}
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-emerald-300 focus:ring"
          />

          <textarea
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            rows={3}
            placeholder={language === "en" ? "Description" : "Descripción"}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none ring-emerald-300 focus:ring"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="number"
              min="1"
              step="0.01"
              value={form.price}
              onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
              placeholder={language === "en" ? "Price" : "Precio"}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-emerald-300 focus:ring"
            />
            <input
              type="number"
              min="1"
              value={form.durationMinutes}
              onChange={(event) => setForm((current) => ({ ...current, durationMinutes: event.target.value }))}
              placeholder={language === "en" ? "Duration (min)" : "Duración (min)"}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-emerald-300 focus:ring"
            />
          </div>

          <input
            value={form.imageUrl}
            onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))}
            placeholder={language === "en" ? "Image URL (optional)" : "URL de imagen (opcional)"}
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-emerald-300 focus:ring"
          />

          <button
            type="submit"
            disabled={isSubmitting || branches.length === 0 || !form.branchId}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? (language === "en" ? "Saving..." : "Guardando...") : (language === "en" ? "Save service" : "Guardar servicio")}
          </button>
        </form>
      </article>

      <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{t("business.services")}</p>
        <h2 className="mt-2 text-2xl font-black text-[#151138]">{language === "en" ? "Your catalog" : "Tu catálogo"}</h2>

        <div className="mt-5 space-y-3">
          {services.map((service) => (
            <div key={service.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-800">{service.service_name}</p>
                  {service.description ? <p className="mt-1 text-sm text-slate-600">{service.description}</p> : null}
                  <p className="mt-1 text-xs font-medium text-indigo-600">
                    {language === "en" ? "Branch:" : "Sucursal:"} {service.branch_name ?? (language === "en" ? "No branch" : "Sin sucursal")}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-emerald-700">${Number(service.price).toFixed(2)}</p>
                  {service.duration_minutes ? (
                    <p className="text-xs text-slate-500">{service.duration_minutes} min</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(service.id)}
                  className="rounded-lg bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-200"
                >
                  {language === "en" ? "Delete" : "Eliminar"}
                </button>
              </div>
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
