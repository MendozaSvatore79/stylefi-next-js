"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { useToast } from "@/components/toast";
import { useLanguage } from "@/lib/language-context";

const copy = {
  es: {
    brand: "STYLEHUB",
    back: "Volver al login",
    section: "Recuperar contraseña",
    title: "Restablece tu acceso",
    subtitle: "Te enviaremos un enlace por correo y un OTP para validar tu identidad.",
    imageTitle: "Recupera tu acceso con seguridad",
    imageDesc: "Te enviaremos un enlace por correo y un OTP para validar tu identidad.",
    email: "Correo electrónico",
    emailPlaceholder: "correo@ejemplo.com",
    send: "Enviar enlace de recuperación",
    sending: "Enviando...",
    sentTitle: "Solicitud enviada",
    sentMsg: "Revisa tu correo para continuar.",
    sentFallback: "Si el correo existe, recibirás un enlace de recuperación.",
    errorTitle: "No se pudo enviar la recuperación",
    errorMsg: "Inténtalo otra vez.",
    errorFallback: "No se pudo enviar la recuperación.",
    loadError: "No se pudo enviar la recuperación.",
  },
  en: {
    brand: "STYLEHUB",
    back: "Back to sign in",
    section: "Recover password",
    title: "Reset your access",
    subtitle: "We'll send you an email link and an OTP to verify your identity.",
    imageTitle: "Recover your access securely",
    imageDesc: "We'll send you an email link and an OTP to verify your identity.",
    email: "Email address",
    emailPlaceholder: "email@example.com",
    send: "Send recovery link",
    sending: "Sending...",
    sentTitle: "Request sent",
    sentMsg: "Check your email to continue.",
    sentFallback: "If the email exists, you'll receive a recovery link.",
    errorTitle: "Could not send recovery",
    errorMsg: "Please try again.",
    errorFallback: "Could not send recovery.",
    loadError: "Could not send recovery.",
  },
} as const;

export default function ForgotPasswordPage() {
  const { showToast } = useToast();
  const { language } = useLanguage();
  const text = language === "en" ? copy.en : copy.es;
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/password-reset/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const payload = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? text.errorFallback);
      }

      showToast({
        type: "success",
        title: text.sentTitle,
        message: payload.message ?? text.sentMsg,
      });

      setMessage(payload.message ?? text.sentFallback);
    } catch (requestError) {
      showToast({
        type: "error",
        title: text.errorTitle,
        message: requestError instanceof Error ? requestError.message : text.errorMsg,
      });
      setError(requestError instanceof Error ? requestError.message : text.errorFallback);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#ececef] text-slate-900">
      <header className="w-full border-b border-slate-300 bg-white px-4 py-3 sm:px-8">
        <div className="flex w-full items-center justify-between gap-4">
          <Link href="/" className="text-3xl font-black tracking-[0.16em] text-[#171135]">
            {text.brand}
          </Link>
          <Link
            href="/iniciar-sesion"
            className="rounded-full bg-slate-200 px-4 py-2 text-xs font-bold uppercase text-slate-700 transition hover:bg-slate-300 sm:text-sm"
          >
            {text.back}
          </Link>
        </div>
      </header>

      <section className="grid min-h-[calc(100vh-73px)] w-full lg:grid-cols-2">
        <article
          className="relative hidden min-h-[calc(100vh-73px)] overflow-hidden bg-[#0d1b3d] lg:block"
        >
          <img
            src="/recovery-bg.svg"
            alt="STYLEHUB recuperación"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-br from-[#0d1b3d]/75 via-[#130b3a]/40 to-black/20" />
          <div className="absolute bottom-8 left-8 right-8 max-w-md rounded-3xl border border-white/20 bg-white/10 p-6 text-white backdrop-blur-md shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">{text.brand}</p>
            <h2 className="mt-2 text-3xl font-black leading-tight">{text.imageTitle}</h2>
            <p className="mt-3 text-sm text-white/80">{text.imageDesc}</p>
          </div>
        </article>

        <article className="flex items-center justify-center px-6 py-10 sm:px-10 lg:justify-end lg:pr-24">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{text.section}</p>
            <h1 className="mt-2 text-4xl font-black leading-tight text-[#151138]">{text.title}</h1>
            <p className="mt-3 text-sm text-slate-600">{text.subtitle}</p>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </div>
              ) : null}

              {message ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  {message}
                </div>
              ) : null}

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">{text.email}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-blue-300 focus:ring"
                  placeholder={text.emailPlaceholder}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-[#130b3a] text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#231365] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? text.sending : text.send}
              </button>
            </form>
          </div>
        </article>
      </section>
    </main>
  );
}
