"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Building2, CreditCard, ShieldCheck } from "lucide-react";

import AccountSecurityPanel from "@/components/account-security-panel";
import { useToast } from "@/components/toast";
import { api } from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { errorTelefono, errorTexto, LIMITES, limpiarTelefono, primerError } from "@/lib/validacion";

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


/** Textos de la pantalla (antes solo en español). */
const T = {
  seccion: { es: "Configuración", en: "Settings" },
  titulo: { es: "Ajustes del negocio", en: "Business settings" },
  descripcion: { es: "Administra tu perfil de salón, horarios, seguridad y opciones de negocio.", en: "Manage your salon profile, hours, security and business options." },
  perfil: { es: "Perfil", en: "Profile" },
  datosSalon: { es: "Datos del salón", en: "Salon details" },
  seguridad: { es: "Seguridad", en: "Security" },
  accesoContrasena: { es: "Acceso y contraseña", en: "Access and password" },
  facturacion: { es: "Facturación", en: "Billing" },
  pagosPlanes: { es: "Pagos y planes", en: "Payments and plans" },
  datosNegocio: { es: "Datos del negocio", en: "Business details" },
  porSucursal: { es: "El nombre, la dirección, el horario y la foto que ven los clientes son los de cada sucursal.", en: "The name, address, hours and photo clients see are those of each branch." },
  principal: { es: "Sucursal principal", en: "Main branch" },
  sinSucursales: { es: "Todavía no tienes sucursales.", en: "You don't have any branches yet." },
  editarSucursales: { es: "Editar en Sucursales", en: "Edit in Branches" },
  infoCuenta: { es: "Información de la cuenta", en: "Account information" },
  nombreLegal: { es: "Nombre legal del negocio", en: "Legal business name" },
  telefonoContacto: { es: "Teléfono de contacto", en: "Contact phone" },
  telefonoPlaceholder: { es: "Teléfono (10 dígitos)", en: "Phone (10 digits)" },
  accesoSeguridad: { es: "Acceso y seguridad", en: "Access and security" },
  seguridadDesc: { es: "Administra tu contraseña, métodos de acceso y opciones de eliminación de cuenta.", en: "Manage your password, sign-in methods and account deletion options." },
  pagosSuscripcion: { es: "Pagos y suscripción", en: "Payments and subscription" },
  facturacionDesc: { es: "Aquí verás tu plan y tus pagos cuando estén disponibles.", en: "Your plan and payments will appear here once they're available." },
  proximamente: { es: "Próximamente", en: "Coming soon" },
  proximamenteDesc: { es: "Los planes y la facturación para negocios llegarán pronto.", en: "Plans and billing for businesses are coming soon." },
  revisaFormulario: { es: "Revisa el formulario", en: "Check the form" },
  noSeGuardoPerfil: { es: "No se pudo guardar el perfil.", en: "The profile could not be saved." },
  perfilActualizado: { es: "Perfil actualizado", en: "Profile updated" },
  perfilActualizadoDesc: { es: "Tus datos de negocio se guardaron correctamente.", en: "Your business details were saved." },
  noSeGuardo: { es: "No se pudo guardar", en: "Could not save" },
  intentaDeNuevo: { es: "Intenta de nuevo", en: "Please try again" },
} as const;

export default function NegocioConfiguracionPage() {
  const { language } = useLanguage();
  const { showToast } = useToast();
  const [activeSection, setActiveSection] = useState<"profile" | "security" | "billing">("profile");
  const [isSaving, setIsSaving] = useState(false);
  /** Sucursal principal en solo lectura: los datos del salón se editan en Sucursales (lo que ve el cliente). */
  const [primaryBranch, setPrimaryBranch] = useState<{ id: string; branch_name: string; validation_status: string; address: string | null; city: string | null } | null>(null);
  const [cargado, setCargado] = useState(false);
  /** Teléfono como se cargó: si no se toca, se acepta aunque no cumpla el formato nuevo (igual que el backend). */
  const [telefonoGuardado, setTelefonoGuardado] = useState("");
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

      setTelefonoGuardado(payload.profile.phone ?? "");
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
    // Mismos límites y formatos que el backend (lib/validacion.ts)
    const errorDeCampos = primerError(
      errorTexto(form.businessName, { es: "El nombre legal del negocio", en: "The legal name" }, LIMITES.nombreLegal, language),
      form.phone === telefonoGuardado ? null : errorTelefono(form.phone, language),
    );
    if (errorDeCampos) {
      showToast({ type: "error", title: T.revisaFormulario[language], message: errorDeCampos });
      return;
    }
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
        throw new Error(payload.error ?? T.noSeGuardoPerfil[language]);
      }

      showToast({
        type: "success",
        title: T.perfilActualizado[language],
        message: T.perfilActualizadoDesc[language],
      });
    } catch (error) {
      showToast({
        type: "error",
        title: T.noSeGuardo[language],
        message: error instanceof Error ? error.message : T.intentaDeNuevo[language],
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{T.seccion[language]}</p>
        <h2 className="mt-2 text-2xl font-black text-[#151138]">{T.titulo[language]}</h2>
        <p className="mt-3 max-w-2xl text-sm text-slate-600">
          {T.descripcion[language]}
        </p>

        <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setActiveSection("profile")}
            className={`group relative overflow-hidden rounded-2xl border-2 px-2 py-3 text-center sm:px-4 sm:py-4 transition-all ${
              activeSection === "profile"
                ? "border-emerald-600 bg-emerald-50 shadow-md"
                : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
            }`}
          >
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-emerald-600">
              <Building2 className="size-5" />
            </div>
            <p className={`mt-2 text-xs font-semibold wrap-break-word transition sm:text-sm ${
              activeSection === "profile" ? "text-emerald-700" : "text-slate-700 group-hover:text-slate-900"
            }`}>
              {T.perfil[language]}
            </p>
            <p className={`mt-1 text-xs transition ${
              activeSection === "profile" ? "text-emerald-800" : "text-slate-600"
            }`}>
              {T.datosSalon[language]}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection("security")}
            className={`group relative overflow-hidden rounded-2xl border-2 px-2 py-3 text-center sm:px-4 sm:py-4 transition-all ${
              activeSection === "security"
                ? "border-emerald-600 bg-emerald-50 shadow-md"
                : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
            }`}
          >
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-emerald-600">
              <ShieldCheck className="size-5" />
            </div>
            <p className={`mt-2 text-xs font-semibold wrap-break-word transition sm:text-sm ${
              activeSection === "security" ? "text-emerald-700" : "text-slate-700 group-hover:text-slate-900"
            }`}>
              {T.seguridad[language]}
            </p>
            <p className={`mt-1 text-xs transition ${
              activeSection === "security" ? "text-emerald-800" : "text-slate-600"
            }`}>
              {T.accesoContrasena[language]}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection("billing")}
            className={`group relative overflow-hidden rounded-2xl border-2 px-2 py-3 text-center sm:px-4 sm:py-4 transition-all ${
              activeSection === "billing"
                ? "border-emerald-600 bg-emerald-50 shadow-md"
                : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
            }`}
          >
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-emerald-600">
              <CreditCard className="size-5" />
            </div>
            <p className={`mt-2 text-xs font-semibold wrap-break-word transition sm:text-sm ${
              activeSection === "billing" ? "text-emerald-700" : "text-slate-700 group-hover:text-slate-900"
            }`}>
              {T.facturacion[language]}
            </p>
            <p className={`mt-1 text-xs transition ${
              activeSection === "billing" ? "text-emerald-800" : "text-slate-600"
            }`}>
              {T.pagosPlanes[language]}
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
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{T.perfil[language]}</p>
              <h3 className="mt-2 text-xl font-black text-[#151138]">{T.datosNegocio[language]}</h3>
              <p className="mt-2 text-sm text-slate-600">
                {T.porSucursal[language]}
              </p>
            </div>
          </div>

          <div data-sucursal-principal className="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">{T.principal[language]}</p>
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
              <p className="mt-1 text-sm text-slate-600">{T.sinSucursales[language]}</p>
            ) : null}
            <Link href="/dashboard/negocio/sucursales" className="mt-2 inline-block text-sm font-semibold text-indigo-700 underline">
              {T.editarSucursales[language]}
            </Link>
          </div>

          {/* Los demás campos de stylehub_business_info no los leía nadie más (ni el catálogo ni el admin) y se
              quitaron de la pantalla (decisión de producto). Se siguen enviando con su valor guardado para no borrarlos. */}
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">{T.infoCuenta[language]}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-slate-600">
                  {T.nombreLegal[language]}
                  <input
                    value={form.businessName}
                    onChange={(event) => setForm((current) => ({ ...current, businessName: event.target.value }))}
                    maxLength={LIMITES.nombreLegal}
                    placeholder={T.nombreLegal[language]}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-emerald-300 focus:ring"
                  />
                </label>
                <label className="text-xs font-medium text-slate-600">
                  {T.telefonoContacto[language]}
                  <input
                    value={form.phone}
                    onChange={(event) => setForm((current) => ({ ...current, phone: limpiarTelefono(event.target.value) }))}
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder={T.telefonoPlaceholder[language]}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-emerald-300 focus:ring"
                  />
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
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
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{T.seguridad[language]}</p>
              <h3 className="mt-2 text-xl font-black text-[#151138]">{T.accesoSeguridad[language]}</h3>
              <p className="mt-2 text-sm text-slate-600">
                {T.seguridadDesc[language]}
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
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{T.facturacion[language]}</p>
              <h3 className="mt-2 text-xl font-black text-[#151138]">{T.pagosSuscripcion[language]}</h3>
              <p className="mt-2 text-sm text-slate-600">
                {T.facturacionDesc[language]}
              </p>
            </div>
          </div>

          {/* Antes había un plan, un precio y una fecha de pago inventados, y un botón que no hacía nada: no hay
              suscripciones ni pagos en línea. Decisión de Eric (2026-11-25): "Próximamente". */}
          <div role="status" className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">{T.proximamente[language]}</p>
            <p className="mt-2 text-sm text-slate-600">{T.proximamenteDesc[language]}</p>
          </div>
        </article>
      ) : null}
    </section>
  );
}
