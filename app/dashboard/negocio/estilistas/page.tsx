"use client";

import { useEffect, useState, type FormEvent } from "react";

import { useToast } from "@/components/toast";
import { useLanguage } from "@/lib/language-context";

type Stylist = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  specialization: string | null;
  years_experience: number | null;
  available: boolean;
  branch_id: string | null;
  branch_name: string | null;
};

type Branch = {
  id: string;
  branch_name: string;
};

export default function NegocioEstilistasPage() {
  const { showToast } = useToast();
  const { t, language } = useLanguage();
  const [stylists, setStylists] = useState<Stylist[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    branchId: "",
    firstName: "",
    lastName: "",
    email: "",
    specialization: "",
    yearsExperience: "",
    available: true,
  });

  const loadStylists = async () => {
    const response = await fetch("/api/business/stylists", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { stylists: Stylist[] };
    setStylists(payload.stylists ?? []);
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
    void loadStylists();
    void loadBranches();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/business/stylists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: form.branchId,
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          specialization: form.specialization,
          yearsExperience: Number(form.yearsExperience || 0),
          available: form.available,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? t("business.stylists.errorAdd"));
      }

      showToast({
        type: "success",
        title: t("business.stylists.successAdd"),
        message: language === "en" ? "The stylist profile was created successfully." : "El perfil del estilista se creó correctamente.",
      });

      setForm({
        branchId: "",
        firstName: "",
        lastName: "",
        email: "",
        specialization: "",
        yearsExperience: "",
        available: true,
      });

      await loadStylists();
    } catch (error) {
      showToast({
        type: "error",
        title: t("business.stylists.errorAdd"),
        message: error instanceof Error ? error.message : (language === "en" ? "Try again" : "Intenta de nuevo"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const response = await fetch("/api/business/stylists", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      showToast({
        type: "error",
        title: t("business.stylists.errorDelete"),
        message: payload.error ?? (language === "en" ? "Try again" : "Intenta de nuevo"),
      });
      return;
    }

    showToast({ type: "success", title: t("business.stylists.successDelete") });
    await loadStylists();
  };

  return (
    <section className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
      <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{language === "en" ? "Team" : "Equipo"}</p>
        <h2 className="mt-2 text-2xl font-black text-[#151138]">{language === "en" ? "Register stylist" : "Registrar estilista"}</h2>

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

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={form.firstName}
              onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
              placeholder={language === "en" ? "First name" : "Nombre"}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-emerald-300 focus:ring"
            />
            <input
              value={form.lastName}
              onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
              placeholder={language === "en" ? "Last name" : "Apellido"}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-emerald-300 focus:ring"
            />
          </div>

          <input
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="Email"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-emerald-300 focus:ring"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={form.specialization}
              onChange={(event) => setForm((current) => ({ ...current, specialization: event.target.value }))}
              placeholder={language === "en" ? "Specialization" : "Especialidad"}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-emerald-300 focus:ring"
            />
            <input
              type="number"
              min="0"
              value={form.yearsExperience}
              onChange={(event) => setForm((current) => ({ ...current, yearsExperience: event.target.value }))}
              placeholder={language === "en" ? "Years of experience" : "Años experiencia"}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-emerald-300 focus:ring"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.available}
              onChange={(event) => setForm((current) => ({ ...current, available: event.target.checked }))}
            />
            {language === "en" ? "Available for appointments" : "Disponible para citas"}
          </label>

          <button
            type="submit"
            disabled={isSubmitting || branches.length === 0 || !form.branchId}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? (language === "en" ? "Saving..." : "Guardando...") : (language === "en" ? "Save stylist" : "Guardar estilista")}
          </button>
        </form>
      </article>

      <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{t("business.stylists")}</p>
        <h2 className="mt-2 text-2xl font-black text-[#151138]">{language === "en" ? "Your team" : "Tu equipo"}</h2>

        <div className="mt-5 space-y-3">
          {stylists.map((stylist) => (
            <div key={stylist.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-800">
                    {stylist.first_name} {stylist.last_name}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{stylist.specialization || (language === "en" ? "No specialization" : "Sin especialidad")}</p>
                  <p className="mt-1 text-xs font-medium text-indigo-600">
                    {language === "en" ? "Branch:" : "Sucursal:"} {stylist.branch_name ?? (language === "en" ? "No branch" : "Sin sucursal")}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {stylist.years_experience
                      ? language === "en"
                        ? `${stylist.years_experience} years`
                        : `${stylist.years_experience} años`
                      : language === "en"
                        ? "Experience not specified"
                        : "Experiencia no indicada"}
                  </p>
                  <span
                    className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                      stylist.available ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {stylist.available
                      ? language === "en"
                        ? "Available"
                        : "Disponible"
                      : language === "en"
                        ? "Unavailable"
                        : "No disponible"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(stylist.id)}
                  className="rounded-lg bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-200"
                >
                  {language === "en" ? "Delete" : "Eliminar"}
                </button>
              </div>
            </div>
          ))}

          {stylists.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
              {language === "en" ? "You haven't added stylists yet." : "Aún no has agregado estilistas."}
            </p>
          ) : null}

          {branches.length === 0 ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {language === "en"
                ? "First register at least one branch in the branches tab to link stylists."
                : "Primero registra al menos una sucursal en la pestaña de sucursales para vincular estilistas."}
            </p>
          ) : null}
        </div>
      </article>
    </section>
  );
}
