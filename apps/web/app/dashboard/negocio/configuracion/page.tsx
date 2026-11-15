"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Building2, CreditCard, ShieldCheck } from "lucide-react";

import AccountSecurityPanel from "@/components/account-security-panel";
import { useToast } from "@/components/toast";
import { api } from "@/lib/api";

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
  /** Sucursal principal en solo lectura: los datos del salón se editan en Sucursales (lo que ve el cliente). */
  const [primaryBranch, setPrimaryBranch] = useState<{ id: string; branch_name: string; validation_status: string; address: string | null; city: string | null } | null>(null);
  const [cargado, setCargado] = useState(false);
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
      const response = await api("/api/business/profile", { cache: "no-store" });
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as { profile: BusinessProfile | null; primaryBranch?: typeof primaryBranch };
      setPrimaryBranch(payload.primaryBranch ?? null);
      setCargado(true);
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
      const response = await api("/api/business/profile", {
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
              <Building2 className="size-5" />
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
              <ShieldCheck className="size-5" />
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
              <CreditCard className="size-5" />
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
              <Building2 className="size-8" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Perfil</p>
              <h3 className="mt-2 text-xl font-black text-[#151138]">Datos del negocio</h3>
              <p className="mt-2 text-sm text-slate-600">
                El nombre, la dirección, el horario y la foto que ven los clientes son los de cada sucursal.
              </p>
            </div>
          </div>

          <div data-sucursal-principal className="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Sucursal principal</p>
            {primaryBranch ? (
              <>
                <p className="mt-1 text-lg font-bold text-[#151138]">{primaryBranch.branch_name}</p>
                <p className="text-sm text-slate-600">
                  {[primaryBranch.address, primaryBranch.city].filter(Boolean).join(" · ") || "Sin dirección"}
                  {" · "}
                  {primaryBranch.validation_status === "approved"
                    ? "Aprobada"
                    : primaryBranch.validation_status === "rejected"
                      ? "Rechazada"
                      : "Pendiente de aprobación"}
                </p>
              </>
            ) : cargado ? (
              <p className="mt-1 text-sm text-slate-600">Todavía no tienes sucursales.</p>
            ) : null}
            <Link href="/dashboard/negocio/sucursales" className="mt-2 inline-block text-sm font-semibold text-indigo-700 underline">
              Editar en Sucursales
            </Link>
          </div>

          {/* Los demás campos de stylehub_business_info no los leía nadie más (ni el catálogo ni el admin) y se
              quitaron de la pantalla (decisión de producto). Se siguen enviando con su valor guardado para no borrarlos. */}
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">Información de la cuenta</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-slate-600">
                  Nombre legal del negocio
                  <input
                    value={form.businessName}
                    onChange={(event) => setForm((current) => ({ ...current, businessName: event.target.value }))}
                    placeholder="Nombre legal del negocio"
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-emerald-300 focus:ring"
                  />
                </label>
                <label className="text-xs font-medium text-slate-600">
                  Teléfono de contacto
                  <input
                    value={form.phone}
                    onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                    placeholder="Teléfono"
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-emerald-300 focus:ring"
                  />
                </label>
              </div>
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
              <ShieldCheck className="size-8" />
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
              <CreditCard className="size-8" />
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
