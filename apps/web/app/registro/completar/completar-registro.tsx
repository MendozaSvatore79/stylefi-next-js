"use client";

import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useLanguage } from "@/lib/language-context";

const textos = {
  es: {
    titulo: "Completa tu registro",
    sub: "Un último paso: dinos si vienes a reservar o a ofrecer tus servicios.",
    cliente: "Cliente",
    clienteDesc: "Reserva citas, guarda favoritos y usa tu monedero.",
    negocio: "Negocio",
    negocioDesc: "Administra tu salón, servicios, estilistas y citas.",
    correo: "Correo",
    sinVerificar: "Tu correo aún no está verificado. Vuelve a entrar y verifica tu correo.",
    nombre: "Nombre",
    apellidos: "Apellidos",
    nombreNegocio: "Nombre del negocio",
    rfc: "RFC",
    telefono: "Teléfono",
    continuar: "Continuar",
    guardando: "Guardando...",
    salir: "Usar otra cuenta",
    error: "No se pudo completar el registro.",
  },
  en: {
    titulo: "Complete your sign-up",
    sub: "One last step: tell us whether you're booking or offering services.",
    cliente: "Client",
    clienteDesc: "Book appointments, save favorites and use your wallet.",
    negocio: "Business",
    negocioDesc: "Manage your salon, services, stylists and appointments.",
    correo: "Email",
    sinVerificar: "Your email isn't verified yet. Sign in again and verify your email.",
    nombre: "First name",
    apellidos: "Last name",
    nombreNegocio: "Business name",
    rfc: "Tax ID (RFC)",
    telefono: "Phone",
    continuar: "Continue",
    guardando: "Saving...",
    salir: "Use another account",
    error: "We couldn't complete your sign-up.",
  },
};

const campo = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-indigo-300 focus:ring";

export default function CompletarRegistro({
  correo,
  nombre,
  apellido,
}: {
  correo: string | null;
  nombre: string;
  apellido: string;
}) {
  const { language } = useLanguage();
  const t = textos[language === "en" ? "en" : "es"];
  const router = useRouter();
  const { signOut } = useClerk();
  const [tipo, setTipo] = useState<"cliente" | "negocio" | null>(null);
  const [datos, setDatos] = useState({ firstName: nombre, lastName: apellido, businessName: "", rfc: "", phone: "" });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cambiar = (k: keyof typeof datos) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDatos((d) => ({ ...d, [k]: e.target.value }));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!tipo) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/registro/completar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountType: tipo, ...datos }),
      });
      const cuerpo = (await res.json().catch(() => ({}))) as { error?: string; redirectTo?: string };
      if (!res.ok) throw new Error(cuerpo.error ?? t.error);
      router.replace(cuerpo.redirectTo ?? "/entrar");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-xl">
      <form onSubmit={enviar} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900">{t.titulo}</h1>
        <p className="mt-1 text-sm text-slate-600">{t.sub}</p>
        <p className="mt-4 text-sm text-slate-700">
          {t.correo}: <span className="font-semibold">{correo ?? "—"}</span>
        </p>
        {!correo ? <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{t.sinVerificar}</p> : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {(["cliente", "negocio"] as const).map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => setTipo(op)}
              aria-pressed={tipo === op}
              className={`rounded-2xl border p-4 text-left transition ${tipo === op ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:border-slate-300"}`}
            >
              <span className="block font-semibold text-slate-900">{op === "cliente" ? t.cliente : t.negocio}</span>
              <span className="mt-1 block text-xs text-slate-600">{op === "cliente" ? t.clienteDesc : t.negocioDesc}</span>
            </button>
          ))}
        </div>

        {tipo ? (
          <div className="mt-5 grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <input className={campo} placeholder={t.nombre} value={datos.firstName} onChange={cambiar("firstName")} required={tipo === "negocio"} />
              <input className={campo} placeholder={t.apellidos} value={datos.lastName} onChange={cambiar("lastName")} required={tipo === "negocio"} />
            </div>
            {tipo === "negocio" ? (
              <>
                <input className={campo} placeholder={t.nombreNegocio} value={datos.businessName} onChange={cambiar("businessName")} required />
                <input className={campo} placeholder={t.rfc} value={datos.rfc} onChange={cambiar("rfc")} required maxLength={13} />
              </>
            ) : null}
            <input className={campo} placeholder={t.telefono} value={datos.phone} onChange={cambiar("phone")} required type="tel" />
          </div>
        ) : null}

        {error ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => void signOut({ redirectUrl: "/iniciar-sesion" })} className="text-sm font-semibold text-slate-500 hover:text-slate-700">
            {t.salir}
          </button>
          <button
            type="submit"
            disabled={!tipo || !correo || enviando}
            className="h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enviando ? t.guardando : t.continuar}
          </button>
        </div>
      </form>
      </div>
    </main>
  );
}
