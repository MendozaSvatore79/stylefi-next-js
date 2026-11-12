"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useToast } from "@/components/toast";
import { useLanguage } from "@/lib/language-context";

type ResetPasswordClientProps = {
  resetId: string;
  token: string;
};

const copy = {
  es: {
    brand: "STYLEHUB",
    back: "Volver al login",
    section: "Restablecer contraseña",
    title: "Nueva contraseña",
    subtitle: "Ingresa el OTP recibido por correo y define tu nueva contraseña.",
    imageTitle: "Recupera tu acceso con seguridad",
    imageDesc: "Verificación por enlace y OTP para que el cambio de contraseña sea seguro y rápido.",
    otp: "OTP",
    otpPlaceholder: "000000",
    newPassword: "Nueva contraseña",
    confirmPassword: "Confirmar contraseña",
    updating: "Restableciendo...",
    update: "Actualizar contraseña",
    mismatch: "Las contraseñas no coinciden.",
    successTitle: "Contraseña actualizada",
    successMsg: "Ahora puedes iniciar sesión.",
    successFallback: "Contraseña actualizada correctamente.",
    errorTitle: "No se pudo restablecer la contraseña",
    errorMsg: "Verifica el OTP y vuelve a intentar.",
    errorFallback: "No se pudo restablecer la contraseña.",
  },
  en: {
    brand: "STYLEHUB",
    back: "Back to sign in",
    section: "Reset password",
    title: "New password",
    subtitle: "Enter the OTP you received by email and set your new password.",
    imageTitle: "Recover your access securely",
    imageDesc: "Link and OTP verification make the password change safe and fast.",
    otp: "OTP",
    otpPlaceholder: "000000",
    newPassword: "New password",
    confirmPassword: "Confirm password",
    updating: "Updating...",
    update: "Update password",
    mismatch: "Passwords do not match.",
    successTitle: "Password updated",
    successMsg: "You can sign in now.",
    successFallback: "Password updated successfully.",
    errorTitle: "Could not reset password",
    errorMsg: "Check the OTP and try again.",
    errorFallback: "Could not reset password.",
  },
} as const;

export default function ResetPasswordClient({ resetId, token }: ResetPasswordClientProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const { language } = useLanguage();
  const text = language === "en" ? copy.en : copy.es;
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (password !== confirmPassword) {
      setError(text.mismatch);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/password-reset/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rid: resetId,
          token,
          otp,
          password,
        }),
      });

      const payload = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? text.errorFallback);
      }

      showToast({
        type: "success",
        title: text.successTitle,
        message: payload.message ?? text.successMsg,
      });

      setMessage(payload.message ?? text.successFallback);
      window.setTimeout(() => {
        router.push("/iniciar-sesion");
      }, 1000);
    } catch (resetError) {
      showToast({
        type: "error",
        title: text.errorTitle,
        message: resetError instanceof Error ? resetError.message : text.errorMsg,
      });
      setError(resetError instanceof Error ? resetError.message : text.errorFallback);
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
        <article className="relative hidden min-h-[calc(100vh-73px)] overflow-hidden bg-[#0d1b3d] lg:block">
          <img
            src="/recovery-bg.svg"
            alt="Recuperación de contraseña STYLEHUB"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-br from-[#0d1b3d]/75 via-[#130b3a]/45 to-black/20" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.12),transparent_30%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.1),transparent_35%)]" />
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
                <label className="mb-2 block text-sm font-semibold text-slate-700">{text.otp}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-blue-300 focus:ring"
                  placeholder={text.otpPlaceholder}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">{text.newPassword}</label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-blue-300 focus:ring"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">{text.confirmPassword}</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-blue-300 focus:ring"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !resetId || !token}
                className="mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-[#130b3a] text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#231365] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? text.updating : text.update}
              </button>
            </form>
          </div>
        </article>
      </section>
    </main>
  );
}
