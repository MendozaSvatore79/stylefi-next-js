"use client";

import { useEffect, useState, type FormEvent } from "react";

import StylistAgendaPanel from "@/components/stylist-agenda-panel";
import AsignarSucursal from "@/components/asignar-sucursal";
import ConfirmarEliminar from "@/components/confirmar-eliminar";
import { useToast } from "@/components/toast";
import { useLanguage } from "@/lib/language-context";
import { api } from "@/lib/api";

type Stylist = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  image_url: string | null;
  specialization: string | null;
  years_experience: number | null;
  available: boolean;
  branch_id: string | null;
  branch_name: string | null;
  service_ids: string[];
  schedule_blocks: number;
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
  /** Tarjeta en confirmación de borrado (en línea, sin modal). */
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
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
    const response = await api("/api/business/stylists", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { stylists: Stylist[] };
    setStylists(payload.stylists ?? []);
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
    void loadStylists();
    void loadBranches();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await api("/api/business/stylists", {
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

  /** Asigna sucursal a un estilista que no tiene (PUT existente: se reenvían sus datos; los servicios no cambian). */
  const asignarSucursal = async (stylist: Stylist, branchId: string) => {
    try {
      const response = await api("/api/business/stylists", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: stylist.id,
          firstName: stylist.first_name,
          lastName: stylist.last_name,
          email: stylist.email ?? "",
          phone: stylist.phone ?? "",
          specialization: stylist.specialization ?? "",
          yearsExperience: stylist.years_experience ?? "",
          imageUrl: stylist.image_url ?? "",
          available: stylist.available,
          branchId,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? (language === "en" ? "Try again" : "Intenta de nuevo"));
      }
      showToast({ type: "success", title: language === "en" ? "Branch assigned" : "Sucursal asignada" });
      await loadStylists();
    } catch (error) {
      showToast({
        type: "error",
        title: language === "en" ? "Could not assign the branch" : "No se pudo asignar la sucursal",
        message: error instanceof Error ? error.message : undefined,
      });
    }
  };

  /** Disponible / No disponible (PUT existente con sus datos actuales). Uno con citas no se puede borrar: se apaga. */
  const cambiarDisponible = async (stylist: Stylist) => {
    try {
      const response = await api("/api/business/stylists", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: stylist.id,
          firstName: stylist.first_name,
          lastName: stylist.last_name,
          email: stylist.email ?? "",
          phone: stylist.phone ?? "",
          specialization: stylist.specialization ?? "",
          yearsExperience: stylist.years_experience ?? "",
          imageUrl: stylist.image_url ?? "",
          available: !stylist.available,
          branchId: stylist.branch_id,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? (language === "en" ? "Try again" : "Intenta de nuevo"));
      }
      showToast({
        type: "success",
        title: !stylist.available
          ? language === "en"
            ? "Stylist available"
            : "Estilista disponible"
          : language === "en"
            ? "Stylist unavailable"
            : "Estilista no disponible",
      });
      await loadStylists();
    } catch (error) {
      showToast({
        type: "error",
        title: language === "en" ? "Could not change availability" : "No se pudo cambiar la disponibilidad",
        message: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleDelete = async (id: string): Promise<string | null> => {
    const response = await api("/api/business/stylists", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    if (!response.ok) {
      // El mensaje (por ejemplo, el 409 con las citas próximas) se muestra en la confirmación, que queda abierta
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      return payload.error ?? (language === "en" ? "Could not delete. Try again." : "No se pudo eliminar. Intenta de nuevo.");
    }

    showToast({ type: "success", title: t("business.stylists.successDelete") });
    await loadStylists();
    return null;
  };

  return (
    <section className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
      <article className="min-w-0 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
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

      <article className="min-w-0 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
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
                  {stylist.branch_id ? (
                    <p className="mt-1 text-xs font-medium text-indigo-600">
                      {language === "en" ? "Branch:" : "Sucursal:"} {stylist.branch_name}
                    </p>
                  ) : (
                    <AsignarSucursal sucursales={branches} idioma={language} onAsignar={(branchId) => asignarSucursal(stylist, branchId)} />
                  )}
                  <p className="mt-1 text-xs text-slate-500">
                    {stylist.years_experience
                      ? language === "en"
                        ? `${stylist.years_experience} years`
                        : `${stylist.years_experience} años`
                      : language === "en"
                        ? "Experience not specified"
                        : "Experiencia no indicada"}
                  </p>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={stylist.available}
                    onClick={() => void cambiarDisponible(stylist)}
                    // Sin sucursal el PUT no se acepta: primero se asigna (aviso ámbar de arriba)
                    disabled={!stylist.branch_id}
                    title={language === "en" ? "Change availability" : "Cambiar disponibilidad"}
                    className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      stylist.available ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                    }`}
                  >
                    <span aria-hidden className={`h-2 w-2 rounded-full ${stylist.available ? "bg-emerald-500" : "bg-slate-500"}`} />
                    {stylist.available
                      ? language === "en"
                        ? "Available"
                        : "Disponible"
                      : language === "en"
                        ? "Unavailable"
                        : "No disponible"}
                  </button>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                <button
                  type="button"
                  onClick={() => setAbierto((a) => (a === stylist.id ? null : stylist.id))}
                  className="rounded-lg bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-200"
                >
                  {abierto === stylist.id ? (language === "en" ? "Close" : "Cerrar") : language === "en" ? "Schedule & services" : "Horario y servicios"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmando(stylist.id)}
                  className="rounded-lg bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-200"
                >
                  {language === "en" ? "Delete" : "Eliminar"}
                </button>
                </div>
              </div>
              {confirmando === stylist.id ? (
                <ConfirmarEliminar
                  nombre={`${stylist.first_name} ${stylist.last_name}`}
                  aviso={
                    language === "en"
                      ? "If they have appointments on record, they can't be deleted: set them as Unavailable instead."
                      : "Si tiene citas registradas, no se podrá eliminar: en ese caso márcalo como No disponible."
                  }
                  idioma={language}
                  onCancelar={() => setConfirmando(null)}
                  onConfirmar={async () => {
                    const error = await handleDelete(stylist.id);
                    if (error) return error;
                    setConfirmando(null);
                  }}
                />
              ) : null}
              {stylist.service_ids.length === 0 || stylist.schedule_blocks === 0 ? (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
                  {language === "en"
                    ? "Without services and a schedule this stylist can't receive appointments."
                    : "Sin servicios ni horario este estilista no puede recibir citas."}
                </p>
              ) : null}
              {abierto === stylist.id ? (
                <StylistAgendaPanel
                  stylistId={stylist.id}
                  branchId={stylist.branch_id}
                  serviceIds={stylist.service_ids}
                  onSaved={() => void loadStylists()}
                />
              ) : null}
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
