"use client";

import { useEffect, useState, type FormEvent } from "react";

import AccountSecurityPanel from "@/components/account-security-panel";
import { IconBuilding, IconLock, IconCreditCard } from "@/components/icons";
import { useToast } from "@/components/toast";

type BusinessProfile = {
  business_name: string | null;
  phone: string | null;
  salon_name: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  latitude: string | null;
  longitude: string | null;
  website: string | null;
  image_url: string | null;
  opening_hours: string | null;
  closing_hours: string | null;
};

export default function NegocioConfiguracionPage() {
  const { showToast } = useToast();
  const [activeSection, setActiveSection] = useState<"profile" | "security" | "billing">("profile");
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    businessName: "",
    phone: "",
    salonName: "",
    description: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    latitude: "",
    longitude: "",
    website: "",
    imageUrl: "",
    openingHours: "",
    closingHours: "",
  });

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/business/profile", { cache: "no-store" });
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as { profile: BusinessProfile | null };
      if (!payload.profile) {
        return;
      }

      setForm({
        businessName: payload.profile.business_name ?? "",
        phone: payload.profile.phone ?? "",
        salonName: payload.profile.salon_name ?? "",
        description: payload.profile.description ?? "",
        address: payload.profile.address ?? "",
        city: payload.profile.city ?? "",
        state: payload.profile.state ?? "",
        postalCode: payload.profile.postal_code ?? "",
        latitude: payload.profile.latitude ?? "",
        longitude: payload.profile.longitude ?? "",
        website: payload.profile.website ?? "",
        imageUrl: payload.profile.image_url ?? "",
        openingHours: payload.profile.opening_hours ?? "",
        closingHours: payload.profile.closing_hours ?? "",
      });
    })();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);

    try {
      const response = await fetch("/api/business/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: form.businessName,
          phone: form.phone,
          salonName: form.salonName,
          description: form.description,
          address: form.address,
          city: form.city,
          state: form.state,
          postalCode: form.postalCode,
          latitude: form.latitude ? Number(form.latitude) : null,
          longitude: form.longitude ? Number(form.longitude) : null,
          website: form.website,
          imageUrl: form.imageUrl,
          openingHours: form.openingHours,
          closingHours: form.closingHours,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo guardar el perfil.");
      }

      showToast({
        type: "success",
        title: "Perfil actualizado",
        message: "Tus datos de negocio se guardaron correctamente.",
      });
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudo guardar",
        message: error instanceof Error ? error.message : "Intenta de nuevo",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Configuración</p>
        <h2 className="mt-2 text-2xl font-black text-[#151138]">Ajustes del negocio</h2>
        <p className="mt-3 max-w-2xl text-sm text-slate-600">
          Administra tu perfil de salón, horarios, seguridad y opciones de negocio.
        </p>

        <div className="mt-6 grid gap-3 grid-cols-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setActiveSection("profile")}
            className={`group relative overflow-hidden rounded-2xl border-2 px-4 py-4 text-center transition-all ${
              activeSection === "profile"
                ? "border-emerald-600 bg-emerald-50 shadow-md"
                : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
            }`}
          >
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-emerald-600">
              <IconBuilding />
            </div>
            <p className={`mt-2 text-sm font-semibold transition ${
              activeSection === "profile" ? "text-emerald-700" : "text-slate-700 group-hover:text-slate-900"
            }`}>
              Perfil
            </p>
            <p className={`mt-1 text-xs transition ${
              activeSection === "profile" ? "text-emerald-600" : "text-slate-500"
            }`}>
              Datos del salón
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection("security")}
            className={`group relative overflow-hidden rounded-2xl border-2 px-4 py-4 text-center transition-all ${
              activeSection === "security"
                ? "border-emerald-600 bg-emerald-50 shadow-md"
                : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
            }`}
          >
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-emerald-600">
              <IconLock />
            </div>
            <p className={`mt-2 text-sm font-semibold transition ${
              activeSection === "security" ? "text-emerald-700" : "text-slate-700 group-hover:text-slate-900"
            }`}>
              Seguridad
            </p>
            <p className={`mt-1 text-xs transition ${
              activeSection === "security" ? "text-emerald-600" : "text-slate-500"
            }`}>
              Acceso y contraseña
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection("billing")}
            className={`group relative overflow-hidden rounded-2xl border-2 px-4 py-4 text-center transition-all ${
              activeSection === "billing"
                ? "border-emerald-600 bg-emerald-50 shadow-md"
                : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
            }`}
          >
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-emerald-600">
              <IconCreditCard />
            </div>
            <p className={`mt-2 text-sm font-semibold transition ${
              activeSection === "billing" ? "text-emerald-700" : "text-slate-700 group-hover:text-slate-900"
            }`}>
              Facturación
            </p>
            <p className={`mt-1 text-xs transition ${
              activeSection === "billing" ? "text-emerald-600" : "text-slate-500"
            }`}>
              Pagos y planes
            </p>
          </button>
        </div>
      </article>

      {activeSection === "profile" ? (
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4 mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
              <IconBuilding />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Perfil</p>
              <h3 className="mt-2 text-xl font-black text-[#151138]">Datos del salón</h3>
              <p className="mt-2 text-sm text-slate-600">
                Configura la información de tu negocio, ubicación, horarios y contacto.
              </p>
            </div>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">Información General</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={form.businessName}
                  onChange={(event) => setForm((current) => ({ ...current, businessName: event.target.value }))}
                  placeholder="Nombre legal negocio"
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-emerald-300 focus:ring"
                />
                <input
                  value={form.salonName}
                  onChange={(event) => setForm((current) => ({ ...current, salonName: event.target.value }))}
                  placeholder="Nombre comercial salón"
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-emerald-300 focus:ring"
                />
              </div>

              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                rows={3}
                placeholder="Descripción del salón"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-300 focus:ring"
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="Teléfono"
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-emerald-300 focus:ring"
                />
                <input
                  value={form.website}
                  onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))}
                  placeholder="Sitio web"
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-emerald-300 focus:ring"
                />
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">Ubicación</p>
              <input
                value={form.address}
                onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                placeholder="Dirección"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-emerald-300 focus:ring"
              />

              <div className="grid gap-3 sm:grid-cols-3">
                <input
                  value={form.city}
                  onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
                  placeholder="Ciudad"
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-emerald-300 focus:ring"
                />
                <input
                  value={form.state}
                  onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))}
                  placeholder="Estado"
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-emerald-300 focus:ring"
                />
                <input
                  value={form.postalCode}
                  onChange={(event) => setForm((current) => ({ ...current, postalCode: event.target.value }))}
                  placeholder="CP"
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-emerald-300 focus:ring"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={form.latitude}
                  onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value }))}
                  placeholder="Latitud"
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-emerald-300 focus:ring"
                />
                <input
                  value={form.longitude}
                  onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value }))}
                  placeholder="Longitud"
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-emerald-300 focus:ring"
                />
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">Horarios y Media</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={form.openingHours}
                  onChange={(event) => setForm((current) => ({ ...current, openingHours: event.target.value }))}
                  placeholder="Horario apertura (ej: 09:00)"
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-emerald-300 focus:ring"
                />
                <input
                  value={form.closingHours}
                  onChange={(event) => setForm((current) => ({ ...current, closingHours: event.target.value }))}
                  placeholder="Horario cierre (ej: 20:00)"
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-emerald-300 focus:ring"
                />
              </div>

              <input
                value={form.imageUrl}
                onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))}
                placeholder="URL imagen del salón"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-emerald-300 focus:ring"
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSaving ? "Guardando..." : "Guardar cambios"}
            </button>
          </form>
        </article>
      ) : null}

      {activeSection === "security" ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4 mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
              <IconLock />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Seguridad</p>
              <h3 className="mt-2 text-xl font-black text-[#151138]">Acceso y seguridad</h3>
              <p className="mt-2 text-sm text-slate-600">
                Administra tu contraseña, métodos de acceso y opciones de eliminación de cuenta.
              </p>
            </div>
          </div>
          <AccountSecurityPanel title="" />
        </div>
      ) : null}

      {activeSection === "billing" ? (
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4 mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
              <IconCreditCard />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Facturación</p>
              <h3 className="mt-2 text-xl font-black text-[#151138]">Pagos y suscripción</h3>
              <p className="mt-2 text-sm text-slate-600">
                Gestiona tu plan de suscripción, pagos y métodos de facturación.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
            <p className="text-sm text-slate-600">Plan Premium activo</p>
            <p className="mt-2 text-2xl font-black text-emerald-600">$29.99/mes</p>
            <p className="mt-1 text-xs text-slate-500">Próximo pago: 15 de mayo de 2026</p>
            <button className="mt-4 inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              Cambiar plan
            </button>
          </div>
        </article>
      ) : null}
    </section>
  );
}
