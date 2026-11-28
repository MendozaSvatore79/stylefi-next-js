"use client";

import { useClerk } from "@clerk/nextjs";
import { useId, useState } from "react";

import { api } from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { errorTelefono, errorTexto, LIMITES, limpiarTelefono, primerError } from "@/lib/validacion";

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
    nombre: "Nombre(s)",
    apellidos: "Apellido(s)",
    nombreNegocio: "Nombre del negocio",
    rfc: "RFC",
    zonaHoraria: "Por ahora STYLEHUB funciona con la hora del centro de México (Ciudad de México): tus horarios y citas se muestran en esa hora.",
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
    nombre: "First name(s)",
    apellidos: "Last name(s)",
    nombreNegocio: "Business name",
    rfc: "Tax ID (RFC)",
    zonaHoraria: "For now STYLEHUB uses central Mexico time (Mexico City): your hours and appointments are shown in that time.",
    telefono: "Phone",
    continuar: "Continue",
    guardando: "Saving...",
    salir: "Use another account",
    error: "We couldn't complete your sign-up.",
  },
};

// Texto oscuro explícito: con el sistema en modo oscuro, globals.css pone el texto del body en #ededed y los inputs
// (fondo blanco) lo heredaban, ilegible.
const campo =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none ring-indigo-300 focus:ring";
const etiqueta = "mb-1 block text-sm font-medium text-slate-700";

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
  const { signOut } = useClerk();
  const id = useId();
  const [tipo, setTipo] = useState<"cliente" | "negocio" | null>(null);
  const [datos, setDatos] = useState({ firstName: nombre, lastName: apellido, businessName: "", rfc: "", phone: "" });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El teléfono se limpia al escribir: solo dígitos, sin lada 52 al pegar, máximo 10
  const cambiar = (k: keyof typeof datos) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDatos((d) => ({ ...d, [k]: k === "phone" ? limpiarTelefono(e.target.value) : e.target.value }));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!tipo) return;
    // Mismos límites y formatos que el backend (lib/validacion.ts); el teléfono es obligatorio para los dos tipos
    const idioma = language === "en" ? "en" : "es";
    const errorDeCampos = primerError(
      errorTexto(datos.firstName, { es: "El nombre", en: "The first name" }, LIMITES.nombre, idioma, { obligatorio: tipo === "negocio" }),
      errorTexto(datos.lastName, { es: "Los apellidos", en: "The last name" }, LIMITES.nombre, idioma, { obligatorio: tipo === "negocio" }),
      tipo === "negocio" ? errorTexto(datos.businessName, { es: "El nombre del negocio", en: "The business name" }, LIMITES.nombreLegal, idioma, { obligatorio: true }) : null,
      errorTelefono(datos.phone, idioma, { obligatorio: true }),
    );
    if (errorDeCampos) {
      setError(errorDeCampos);
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const res = await api("/api/registro/completar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountType: tipo, ...datos }),
      });
      const cuerpo = (await res.json().catch(() => ({}))) as { error?: string; redirectTo?: string };
      if (!res.ok) throw new Error(cuerpo.error ?? t.error);
      // Carga completa (como /entrar): SesionProvider guardó { user: null } mientras la cuenta no existía y solo vuelve
      // a pedir /sesion si cambia el usuario de Clerk; con router.replace el panel se quedaba en "Usuario".
      window.location.replace(cuerpo.redirectTo ?? "/entrar");
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
            {/* Nombre(s) a la izquierda y Apellido(s) a la derecha; con label visible porque Google los precarga */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`${id}-nombre`} className={etiqueta}>{t.nombre}</label>
                <input id={`${id}-nombre`} className={campo} placeholder={t.nombre} value={datos.firstName} onChange={cambiar("firstName")} required={tipo === "negocio"} maxLength={LIMITES.nombre} autoComplete="given-name" />
              </div>
              <div>
                <label htmlFor={`${id}-apellidos`} className={etiqueta}>{t.apellidos}</label>
                <input id={`${id}-apellidos`} className={campo} placeholder={t.apellidos} value={datos.lastName} onChange={cambiar("lastName")} required={tipo === "negocio"} maxLength={LIMITES.nombre} autoComplete="family-name" />
              </div>
            </div>
            {tipo === "negocio" ? (
              <>
                <div>
                  <label htmlFor={`${id}-negocio`} className={etiqueta}>{t.nombreNegocio}</label>
                  <input id={`${id}-negocio`} className={campo} placeholder={t.nombreNegocio} value={datos.businessName} onChange={cambiar("businessName")} required maxLength={LIMITES.nombreLegal} autoComplete="organization" />
                </div>
                <div>
                  <label htmlFor={`${id}-rfc`} className={etiqueta}>{t.rfc} (opcional al registrarte)</label>
                  <input id={`${id}-rfc`} className={campo} placeholder="Ej. ABC210514XY9 (Opcional)" value={datos.rfc} onChange={cambiar("rfc")} maxLength={13} />
                  <p className="mt-1.5 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
                    <strong>Aviso legal (SAT):</strong> Si no registras tu RFC ahora, tus clientes solo podrán pagarte en efectivo en sucursal (el pago en línea con Stripe estará inhabilitado) y no podrás retirar ganancias por CLABE bancaria hasta que registres tu RFC en Configuración.
                  </p>
                </div>
                {/* Decisión de producto (2026-11-20): una sola zona horaria por ahora */}
                <p role="note" data-aviso-zona-horaria className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  {t.zonaHoraria}
                </p>
              </>
            ) : null}
            <div>
              <label htmlFor={`${id}-telefono`} className={etiqueta}>{t.telefono}</label>
              <input id={`${id}-telefono`} className={campo} placeholder={t.telefono} value={datos.phone} onChange={cambiar("phone")} required type="tel" inputMode="numeric" autoComplete="tel" />
            </div>
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
