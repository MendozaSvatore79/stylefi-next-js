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
  rfc?: string | null;
  has_rfc?: boolean;
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

type PayoutInfo = {
  hasRfc: boolean;
  rfc: string | null;
  grossOnlineRevenue: number;
  totalWithdrawn: number;
  availableBalance: number;
  bankAccount: {
    clabe: string;
    bankName: string;
    holderName: string;
    updatedAt?: string;
  } | null;
  withdrawals: Array<{
    id: string;
    amount: string | number;
    clabe: string;
    bankName: string;
    holderName: string;
    status: string;
    reference: string;
    createdAt: string;
  }>;
};

const BANCOS_ABM: Record<string, string> = {
  "002": "Citibanamex",
  "012": "BBVA México",
  "014": "Santander",
  "021": "HSBC",
  "030": "Banco del Bajío",
  "036": "Inbursa",
  "044": "Scotiabank",
  "058": "Banregio",
  "072": "Banorte",
  "127": "Banco Azteca",
  "137": "Bancoppel",
  "646": "STP (Sistema de Transferencias y Pagos)",
  "722": "Mercado Pago W",
};

function validarClabe18(clabeRaw: string): { valida: boolean; banco: string; error?: string } {
  const clabe = clabeRaw.replace(/\D/g, "");
  if (clabe.length !== 18) {
    return { valida: false, banco: "", error: "La CLABE interbancaria debe tener exactamente 18 dígitos numéricos." };
  }
  const pesos = [3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7];
  let suma = 0;
  for (let i = 0; i < 17; i++) {
    suma += (Number(clabe[i]) * pesos[i]) % 10;
  }
  const digitoControl = (10 - (suma % 10)) % 10;
  if (digitoControl !== Number(clabe[17])) {
    return { valida: false, banco: "", error: "El dígito verificador de la CLABE interbancaria es inválido (Módulo 10 ABM)." };
  }
  const prefijo = clabe.slice(0, 3);
  return { valida: true, banco: BANCOS_ABM[prefijo] || `Institución Bancaria (${prefijo})` };
}


/** Textos de la pantalla (antes solo en español). */
const T = {
  seccion: { es: "Configuración", en: "Settings" },
  titulo: { es: "Ajustes del negocio", en: "Business settings" },
  descripcion: { es: "Administra tu perfil de salón, horarios, seguridad y opciones de negocio.", en: "Manage your salon profile, hours, security and business options." },
  perfil: { es: "Perfil", en: "Profile" },
  datosSalon: { es: "Datos del salón", en: "Salon details" },
  seguridad: { es: "Seguridad", en: "Security" },
  accesoContrasena: { es: "Acceso y contraseña", en: "Access and password" },
  facturacion: { es: "Retiros y CLABE", en: "Withdrawals & CLABE" },
  pagosPlanes: { es: "Fondos Stripe y banco", en: "Stripe funds & bank" },
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
  const [hasRfc, setHasRfc] = useState(false);
  const [payoutInfo, setPayoutInfo] = useState<PayoutInfo | null>(null);
  const [clabeForm, setClabeForm] = useState({ clabe: "", holderName: "", bankName: "" });
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isSavingClabe, setIsSavingClabe] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [form, setForm] = useState({
    businessName: "",
    phone: "",
    rfc: "",
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

  const loadPayouts = async (currentRfc?: string | null) => {
    try {
      const res = await api("/api/business/payouts", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as PayoutInfo;
        setPayoutInfo(data);
        if (data.bankAccount) {
          setClabeForm({
            clabe: data.bankAccount.clabe || "",
            holderName: data.bankAccount.holderName || "",
            bankName: data.bankAccount.bankName || "",
          });
        }
        return;
      }
    } catch {
      // Fallback local si el backend remoto aún no expone /api/business/payouts
    }
    const rfcVal = (currentRfc ?? form.rfc).trim().toUpperCase();
    setPayoutInfo((prev) =>
      prev ?? {
        hasRfc: rfcVal.length >= 12,
        rfc: rfcVal || null,
        grossOnlineRevenue: 0,
        totalWithdrawn: 0,
        availableBalance: 0,
        bankAccount: null,
        withdrawals: [],
      },
    );
  };

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

      const rfcLoaded = (payload.profile.rfc ?? "").trim().toUpperCase();
      setTelefonoGuardado(payload.profile.phone ?? "");
      setHasRfc(Boolean(payload.profile.has_rfc || rfcLoaded.length >= 12));
      setForm({
        businessName: payload.profile.business_name ?? "",
        phone: payload.profile.phone ?? "",
        rfc: rfcLoaded,
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
      await loadPayouts(rfcLoaded);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const rfcClean = form.rfc.trim().toUpperCase();
    if (rfcClean && !/^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfcClean)) {
      showToast({
        type: "error",
        title: "RFC inválido",
        message: "Ingresa un RFC válido de 12 o 13 caracteres (persona física o moral) emitido por el SAT.",
      });
      return;
    }
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
          rfc: rfcClean || null,
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

      const payload = (await response.json()) as { error?: string; rfc?: string | null; has_rfc?: boolean };
      if (!response.ok) {
        throw new Error(payload.error ?? T.noSeGuardoPerfil[language]);
      }

      const nuevoHasRfc = Boolean(payload.has_rfc ?? rfcClean.length >= 12);
      setHasRfc(nuevoHasRfc);
      setForm((prev) => ({ ...prev, rfc: rfcClean }));
      await loadPayouts(rfcClean);

      showToast({
        type: "success",
        title: T.perfilActualizado[language],
        message: nuevoHasRfc
          ? "Datos del negocio y RFC fiscal guardados. Pagos con Stripe y retiros CLABE habilitados."
          : T.perfilActualizadoDesc[language],
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

  const handleSaveClabe = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasRfc) {
      showToast({
        type: "error",
        title: "RFC requerido por ley",
        message: "Debes registrar tu RFC fiscal en la pestaña Perfil antes de vincular una cuenta CLABE.",
      });
      return;
    }
    const check = validarClabe18(clabeForm.clabe);
    if (!check.valida) {
      showToast({ type: "error", title: "CLABE inválida", message: check.error ?? "Verifica los 18 dígitos." });
      return;
    }
    if (!clabeForm.holderName.trim()) {
      showToast({ type: "error", title: "Titular requerido", message: "Ingresa el nombre completo o razón social del titular de la cuenta." });
      return;
    }

    setIsSavingClabe(true);
    try {
      const res = await api("/api/business/payouts/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clabe: clabeForm.clabe.replace(/\D/g, ""),
          holderName: clabeForm.holderName.trim(),
          bankName: clabeForm.bankName.trim() || check.banco,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? "No se pudo guardar la cuenta CLABE.");
      }
      showToast({
        type: "success",
        title: "Cuenta CLABE vinculada",
        message: `CLABE verificada (${check.banco}) guardada para tus retiros.`,
      });
      await loadPayouts(form.rfc);
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudo vincular CLABE",
        message: error instanceof Error ? error.message : "Inténtalo de nuevo.",
      });
    } finally {
      setIsSavingClabe(false);
    }
  };

  const handleWithdraw = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasRfc) {
      showToast({
        type: "error",
        title: "Retiros bloqueados (Sin RFC)",
        message: "Por disposición fiscal, registra tu RFC en la pestaña Perfil para poder retirar ganancias.",
      });
      return;
    }
    const amount = Number(withdrawAmount);
    if (!Number.isFinite(amount) || amount < 50) {
      showToast({
        type: "error",
        title: "Monto inválido",
        message: "El monto mínimo de retiro SPEI es de $50.00 MXN.",
      });
      return;
    }

    setIsWithdrawing(true);
    try {
      const res = await api("/api/business/payouts/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string; withdrawal?: { reference?: string } };
      if (!res.ok) {
        throw new Error(payload.error ?? "No se pudo procesar el retiro.");
      }
      setWithdrawAmount("");
      showToast({
        type: "success",
        title: "Retiro SPEI procesado",
        message: `Se transfirieron $${amount.toFixed(2)} MXN a tu cuenta CLABE (${payload.withdrawal?.reference ?? "SPEI"}).`,
      });
      await loadPayouts(form.rfc);
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudo retirar",
        message: error instanceof Error ? error.message : "Inténtalo de nuevo.",
      });
    } finally {
      setIsWithdrawing(false);
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

              <div>
                <label className="text-xs font-medium text-slate-600">
                  RFC fiscal (SAT) — Requerido para pagos en línea con Stripe y retiros CLABE
                  <input
                    value={form.rfc}
                    onChange={(event) => setForm((current) => ({ ...current, rfc: event.target.value.toUpperCase() }))}
                    maxLength={13}
                    placeholder="Ej. ABC210514XY9"
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm uppercase text-slate-900 outline-none ring-emerald-300 focus:ring"
                  />
                </label>
                {hasRfc ? (
                  <p className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                    ✓ RFC fiscal registrado ({form.rfc}). Tus clientes pueden pagarte en línea con saldo Stripe y puedes retirar tus ganancias a tu cuenta CLABE.
                  </p>
                ) : (
                  <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <strong>Aviso legal (SAT):</strong> Sin RFC registrado, tus clientes solo podrán pagarte en efectivo en sucursal (pago en línea con Stripe inhabilitado) y no podrás retirar ganancias bancarias.
                  </p>
                )}
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
        <article className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
              <CreditCard className="size-8" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Finanzas y Retiros SPEI</p>
              <h3 className="mt-2 text-xl font-black text-[#151138]">Retiro de ganancias en línea (CLABE 18 dígitos)</h3>
              <p className="mt-2 text-sm text-slate-600">
                Vincula tu CLABE interbancaria verificada y transfiere las ganancias cobradas en línea con Stripe directamente a tu cuenta bancaria.
              </p>
            </div>
          </div>

          {!hasRfc ? (
            <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
              <p className="font-bold">⚠️ Retiros y pagos con tarjeta bloqueados por falta de RFC fiscal</p>
              <p className="mt-1">
                Por cumplimiento legal y tributario ante el SAT, mientras no registres un RFC válido en tu perfil de negocio, a tus clientes se les deshabilita el pago en línea con Stripe (solo efectivo en sucursal) y no puedes vincular cuenta CLABE ni retirar fondos.
              </p>
              <button
                type="button"
                onClick={() => setActiveSection("profile")}
                className="mt-3 inline-flex h-10 items-center justify-center rounded-xl bg-amber-800 px-4 text-xs font-bold text-white transition hover:bg-amber-900"
              >
                Ir a Perfil para registrar mi RFC →
              </button>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Disponible para retiro</p>
              <p className="mt-2 text-2xl font-black text-emerald-700">
                ${Number(payoutInfo?.availableBalance ?? 0).toFixed(2)} MXN
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Ingresos en línea (Stripe)</p>
              <p className="mt-2 text-2xl font-black text-[#151138]">
                ${Number(payoutInfo?.grossOnlineRevenue ?? 0).toFixed(2)} MXN
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total retirado</p>
              <p className="mt-2 text-2xl font-black text-slate-700">
                ${Number(payoutInfo?.totalWithdrawn ?? 0).toFixed(2)} MXN
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <form onSubmit={handleSaveClabe} className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-bold text-[#151138]">Cuenta bancaria CLABE (18 dígitos)</p>
              <label className="block text-xs font-medium text-slate-600">
                CLABE interbancaria (18 dígitos)
                <input
                  value={clabeForm.clabe}
                  disabled={!hasRfc}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 18);
                    const pref = digits.slice(0, 3);
                    setClabeForm((prev) => ({
                      ...prev,
                      clabe: digits,
                      bankName: BANCOS_ABM[pref] || prev.bankName,
                    }));
                  }}
                  inputMode="numeric"
                  maxLength={18}
                  placeholder="012180001234567899"
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-sm text-slate-900 outline-none ring-emerald-300 focus:ring disabled:opacity-60"
                />
              </label>

              {clabeForm.clabe.length === 18 ? (
                (() => {
                  const v = validarClabe18(clabeForm.clabe);
                  return v.valida ? (
                    <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                      ✓ CLABE verificada (Módulo 10 ABM) · Banco: {v.banco}
                    </p>
                  ) : (
                    <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                      {v.error}
                    </p>
                  );
                })()
              ) : null}

              <label className="block text-xs font-medium text-slate-600">
                Titular de la cuenta (Nombre o Razón Social)
                <input
                  value={clabeForm.holderName}
                  disabled={!hasRfc}
                  onChange={(e) => setClabeForm((prev) => ({ ...prev, holderName: e.target.value }))}
                  placeholder="Nombre del titular o razón social"
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-emerald-300 focus:ring disabled:opacity-60"
                />
              </label>

              <button
                type="submit"
                disabled={!hasRfc || isSavingClabe}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-[#130b3a] px-5 text-sm font-semibold text-white transition hover:bg-[#231365] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingClabe ? "Guardando CLABE..." : "Guardar cuenta CLABE"}
              </button>
            </form>

            <form onSubmit={handleWithdraw} className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-bold text-[#151138]">Solicitar retiro de ganancias SPEI</p>
              <label className="block text-xs font-medium text-slate-600">
                Monto a retirar en MXN (mín. $50.00)
                <input
                  type="number"
                  min={50}
                  step="0.01"
                  disabled={!hasRfc || !payoutInfo?.bankAccount}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="500.00"
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-emerald-300 focus:ring disabled:opacity-60"
                />
              </label>

              <p className="text-xs text-slate-500">
                {payoutInfo?.bankAccount
                  ? `Destino: ${payoutInfo.bankAccount.bankName} · CLABE ••••${payoutInfo.bankAccount.clabe.slice(-4)} (${payoutInfo.bankAccount.holderName})`
                  : "Primero guarda tu cuenta CLABE de 18 dígitos en el formulario de la izquierda."}
              </p>

              <button
                type="submit"
                disabled={!hasRfc || !payoutInfo?.bankAccount || isWithdrawing}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isWithdrawing ? "Procesando SPEI..." : "Retirar fondos a mi CLABE"}
              </button>
            </form>
          </div>
        </article>
      ) : null}
    </section>
  );
}
