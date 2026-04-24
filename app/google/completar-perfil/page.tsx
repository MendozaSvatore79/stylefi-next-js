"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { useToast } from "@/components/toast";
import { useLanguage } from "@/lib/language-context";

type OnboardingStatus =
  | {
      exists: true;
      user: {
        account_type: "cliente" | "negocio";
        first_name: string | null;
        last_name: string | null;
        business_name: string | null;
      };
    }
  | {
      exists: false;
      profile: {
        email: string;
        name: string;
        image: string | null;
      };
    };

const copy = {
  es: {
    profileClient: "Completa tu perfil de cliente",
    profileBusiness: "Completa tu perfil de negocio",
    loading: "Cargando perfil de Google...",
    onboarding: "Google onboarding",
    subtitle: "Si ya existes en nuestra base de datos, entrarás directo. Si no, completa tu perfil para continuar.",
    clientTitle: "Cliente",
    clientDesc: "Accede a reservas, favoritos y wallet.",
    businessTitle: "Negocio",
    businessDesc: "Administra salón, servicios y citas.",
    name: "Nombre",
    lastName: "Apellidos",
    businessName: "Nombre del negocio",
    rfc: "RFC",
    phone: "Teléfono",
    cancel: "Cancelar",
    continue: "Continuar con Google",
    saving: "Guardando...",
    loadErrorTitle: "No se pudo cargar Google",
    loadErrorMsg: "Inténtalo de nuevo.",
    completeSuccessTitle: "Perfil completado",
    completeSuccessMsg: "Ya puedes entrar a tu panel.",
    completeErrorTitle: "No se pudo completar",
    completeErrorMsg: "Inténtalo de nuevo.",
    existsRedirect: true,
  },
  en: {
    profileClient: "Complete your client profile",
    profileBusiness: "Complete your business profile",
    loading: "Loading Google profile...",
    onboarding: "Google onboarding",
    subtitle: "If you already exist in our database, you'll go straight in. If not, complete your profile to continue.",
    clientTitle: "Client",
    clientDesc: "Access bookings, favorites, and wallet.",
    businessTitle: "Business",
    businessDesc: "Manage salon, services, and appointments.",
    name: "First name",
    lastName: "Last name",
    businessName: "Business name",
    rfc: "Tax ID",
    phone: "Phone",
    cancel: "Cancel",
    continue: "Continue with Google",
    saving: "Saving...",
    loadErrorTitle: "Could not load Google",
    loadErrorMsg: "Please try again.",
    completeSuccessTitle: "Profile completed",
    completeSuccessMsg: "You can now enter your dashboard.",
    completeErrorTitle: "Could not complete",
    completeErrorMsg: "Please try again.",
    existsRedirect: true,
  },
} as const;

export default function GoogleCompleteProfilePage() {
  const router = useRouter();
  const { status: sessionStatus } = useSession();
  const { showToast } = useToast();
  const { language } = useLanguage();
  const text = language === "en" ? copy.en : copy.es;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [accountType, setAccountType] = useState<"cliente" | "negocio">("cliente");
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    businessName: "",
    rfc: "",
    phone: "",
  });

  const isBusiness = accountType === "negocio";
  const title = useMemo(
    () => (isBusiness ? text.profileBusiness : text.profileClient),
    [isBusiness, text.profileBusiness, text.profileClient],
  );

  useEffect(() => {
    if (sessionStatus === "loading") {
      return;
    }

    if (sessionStatus === "unauthenticated") {
      router.replace("/iniciar-sesion");
      return;
    }

    const loadStatus = async () => {
      try {
        const response = await fetch("/api/google/onboarding/status", { cache: "no-store" });
        const payload = (await response.json()) as OnboardingStatus & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? (language === "en" ? "Could not load the state." : "No se pudo cargar el estado."));
        }

        setStatus(payload);

        if (payload.exists) {
          router.replace(payload.user.account_type === "negocio" ? "/dashboard/negocio" : "/dashboard/cliente");
          return;
        }

        const [firstName = "", ...rest] = payload.profile.name.split(/\s+/).filter(Boolean);
        setForm((current) => ({
          ...current,
          firstName,
          lastName: rest.join(" "),
        }));
      } catch (error) {
        showToast({
          type: "error",
          title: text.loadErrorTitle,
          message: error instanceof Error ? error.message : text.loadErrorMsg,
        });
      } finally {
        setLoading(false);
      }
    };

    void loadStatus();
  }, [router, sessionStatus, showToast]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const response = await fetch("/api/google/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountType,
          firstName: form.firstName,
          lastName: form.lastName,
          businessName: form.businessName,
          rfc: form.rfc,
          phone: form.phone,
        }),
      });

      const payload = (await response.json()) as { error?: string; redirectTo?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? (language === "en" ? "Could not complete the profile." : "No se pudo completar el perfil."));
      }

      showToast({
        type: "success",
        title: text.completeSuccessTitle,
        message: text.completeSuccessMsg,
      });

      router.replace(payload.redirectTo ?? "/dashboard/cliente");
    } catch (error) {
      showToast({
        type: "error",
        title: text.completeErrorTitle,
        message: error instanceof Error ? error.message : text.completeErrorMsg,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !status) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#ececef] px-4">
        <div className="rounded-3xl border border-slate-200 bg-white px-8 py-10 shadow-2xl">
          <p className="text-sm font-semibold text-slate-600">{text.loading}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#ececef] px-4 py-10">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{text.onboarding}</p>
        <h1 className="mt-2 text-3xl font-black text-[#151138]">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{text.subtitle}</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setAccountType("cliente")}
            className={`rounded-2xl border px-4 py-4 text-left transition ${
              accountType === "cliente"
                ? "border-indigo-600 bg-indigo-50"
                : "border-slate-200 bg-slate-50 hover:bg-slate-100"
            }`}
          >
            <p className="font-bold text-[#151138]">{text.clientTitle}</p>
            <p className="mt-1 text-sm text-slate-600">{text.clientDesc}</p>
          </button>
          <button
            type="button"
            onClick={() => setAccountType("negocio")}
            className={`rounded-2xl border px-4 py-4 text-left transition ${
              accountType === "negocio"
                ? "border-emerald-600 bg-emerald-50"
                : "border-slate-200 bg-slate-50 hover:bg-slate-100"
            }`}
          >
            <p className="font-bold text-[#151138]">{text.businessTitle}</p>
            <p className="mt-1 text-sm text-slate-600">{text.businessDesc}</p>
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <input
            value={form.firstName}
            onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
            placeholder={text.name}
            className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-indigo-300 focus:ring"
          />
          <input
            value={form.lastName}
            onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
            placeholder={text.lastName}
            className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-indigo-300 focus:ring"
          />
        </div>

        {isBusiness ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <input
              value={form.businessName}
              onChange={(event) => setForm((current) => ({ ...current, businessName: event.target.value }))}
              placeholder={text.businessName}
              className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-indigo-300 focus:ring"
            />
            <input
              value={form.rfc}
              onChange={(event) => setForm((current) => ({ ...current, rfc: event.target.value }))}
              placeholder={text.rfc}
              className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-indigo-300 focus:ring"
            />
          </div>
        ) : null}

        <div className="mt-4">
          <input
            value={form.phone}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            placeholder={text.phone}
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-indigo-300 focus:ring"
          />
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => router.replace("/iniciar-sesion")}
            className="h-12 flex-1 rounded-xl border border-slate-300 font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {text.cancel}
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="h-12 flex-1 rounded-xl bg-[#130b3a] font-bold text-white transition hover:bg-[#231365] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? text.saving : text.continue}
          </button>
        </div>
      </div>
    </main>
  );
}
