"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";

import { useToast } from "@/components/toast";
import { OTP_LENGTH } from "@/lib/otp";
import { useLanguage } from "@/lib/language-context";

type OtpClientProps = {
  initialEmail: string;
};

const copy = {
  es: {
    brand: "STYLEHUB",
    back: "Volver al registro",
    section: "Verificación OTP",
    title: "Ingresa tu código de verificación",
    subtitle: "Te enviamos un código de 6 dígitos a tu correo. Escríbelo para activar tu cuenta.",
    email: "Correo electrónico",
    emailPlaceholder: "correo@ejemplo.com",
    verify: "Verificar código",
    verifying: "Verificando...",
    resend: "Reenviar código",
    resending: "Reenviando...",
    timer: "10 min",
    otpVerifiedTitle: "OTP verificado",
    otpVerifiedMsg: "Redirigiendo a tu panel...",
    otpVerifiedFallback: "Cuenta verificada correctamente.",
    verifyErrorTitle: "Error al verificar OTP",
    verifyErrorMsg: "Revisa el código e inténtalo de nuevo.",
    verifyErrorFallback: "No se pudo verificar el OTP.",
    resendTitle: "OTP reenviado",
    resendMsg: "Revisa tu correo.",
    resendFallback: "OTP reenviado por correo.",
    resendErrorTitle: "No se pudo reenviar el OTP",
    resendErrorMsg: "Inténtalo nuevamente.",
    resendErrorFallback: "No se pudo reenviar el OTP.",
  },
  en: {
    brand: "STYLEHUB",
    back: "Back to sign up",
    section: "OTP verification",
    title: "Enter your verification code",
    subtitle: "We sent a 6-digit code to your email. Enter it to activate your account.",
    email: "Email address",
    emailPlaceholder: "email@example.com",
    verify: "Verify code",
    verifying: "Verifying...",
    resend: "Resend code",
    resending: "Resending...",
    timer: "10 min",
    otpVerifiedTitle: "OTP verified",
    otpVerifiedMsg: "Redirecting to your dashboard...",
    otpVerifiedFallback: "Account verified successfully.",
    verifyErrorTitle: "OTP verification error",
    verifyErrorMsg: "Check the code and try again.",
    verifyErrorFallback: "Could not verify the OTP.",
    resendTitle: "OTP resent",
    resendMsg: "Check your email.",
    resendFallback: "OTP resent by email.",
    resendErrorTitle: "Could not resend the OTP",
    resendErrorMsg: "Please try again.",
    resendErrorFallback: "Could not resend the OTP.",
  },
} as const;

export default function OtpClient({ initialEmail }: OtpClientProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const { language } = useLanguage();
  const text = language === "en" ? copy.en : copy.es;
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState<string[]>(Array.from({ length: OTP_LENGTH }, () => ""));
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    setEmail(initialEmail);
  }, [initialEmail]);

  const code = otp.join("");

  const focusInput = (index: number) => {
    inputRefs.current[index]?.focus();
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>, index: number) => {
    const digits = event.target.value.replace(/\D/g, "");

    if (!digits) {
      setOtp((current) => {
        const next = [...current];
        next[index] = "";
        return next;
      });
      return;
    }

    setOtp((current) => {
      const next = [...current];
      next[index] = digits[0];
      return next;
    });

    if (index < OTP_LENGTH - 1) {
      focusInput(index + 1);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      focusInput(index - 1);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const digits = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);

    if (!digits) {
      return;
    }

    event.preventDefault();

    setOtp(Array.from({ length: OTP_LENGTH }, (_, index) => digits[index] ?? ""));
    focusInput(Math.min(digits.length, OTP_LENGTH - 1));
  };

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsVerifying(true);

    try {
      const response = await fetch("/api/register/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          code,
        }),
      });

      const payload = (await response.json()) as { error?: string; message?: string; redirectTo?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? text.verifyErrorFallback);
      }

      showToast({
        type: "success",
        title: text.otpVerifiedTitle,
        message: payload.message ?? text.otpVerifiedMsg,
      });

      setMessage(payload.message ?? text.otpVerifiedFallback);
      window.setTimeout(() => {
        router.push(payload.redirectTo ?? "/");
      }, 900);
    } catch (verifyError) {
      showToast({
        type: "error",
        title: text.verifyErrorTitle,
        message: verifyError instanceof Error ? verifyError.message : text.verifyErrorMsg,
      });
      setError(verifyError instanceof Error ? verifyError.message : text.verifyErrorFallback);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setMessage("");
    setIsResending(true);

    try {
      const response = await fetch("/api/register/resend-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const payload = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? text.resendErrorFallback);
      }

      showToast({
        type: "info",
        title: text.resendTitle,
        message: payload.message ?? text.resendMsg,
      });

      setMessage(payload.message ?? text.resendFallback);
    } catch (resendError) {
      showToast({
        type: "error",
        title: text.resendErrorTitle,
        message: resendError instanceof Error ? resendError.message : text.resendErrorMsg,
      });
      setError(resendError instanceof Error ? resendError.message : text.resendErrorFallback);
    } finally {
      setIsResending(false);
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
            href="/register"
            className="rounded-full bg-slate-200 px-4 py-2 text-xs font-bold uppercase text-slate-700 transition hover:bg-slate-300 sm:text-sm"
          >
            {text.back}
          </Link>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-73px)] w-full lg:grid-cols-2">
        <section
          className="hidden min-h-full bg-cover bg-center lg:block"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=1200&q=80')",
          }}
        />

        <section className="flex items-center justify-center px-6 py-10 sm:px-10 lg:justify-end lg:pr-24">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl sm:p-10 transition-all duration-300">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{text.section}</p>
            <h1 className="mt-2 text-4xl font-black leading-tight text-[#151138]">
              {text.title}
            </h1>
            <p className="mt-3 max-w-md text-sm text-slate-600">{text.subtitle}</p>

            <form className="mt-6 space-y-4" onSubmit={handleVerify}>
              <label className="block text-sm font-semibold text-slate-700">{text.email}</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-blue-300 focus:ring"
                placeholder={text.emailPlaceholder}
              />

              <div className="flex justify-center gap-3 sm:gap-4">
                {otp.map((value, index) => (
                  <input
                    key={index}
                    ref={(element) => {
                      inputRefs.current[index] = element;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    value={value}
                    onChange={(event) => handleChange(event, index)}
                    onKeyDown={(event) => handleKeyDown(event, index)}
                    onPaste={handlePaste}
                    className="h-14 w-14 rounded-2xl border-2 border-slate-300 bg-slate-50 text-center text-2xl font-bold shadow-md outline-none transition-all duration-200 focus:border-[#130b3a] focus:bg-white focus:shadow-lg"
                  />
                ))}
              </div>

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

              <button
                type="submit"
                disabled={isVerifying || code.length !== OTP_LENGTH || !email}
                className="mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-[#130b3a] text-base font-bold uppercase tracking-wide text-white shadow-md transition hover:bg-[#231365] hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
              >
                {isVerifying ? text.verifying : text.verify}
              </button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isResending || !email}
                  className="font-semibold text-blue-700 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isResending ? text.resending : text.resend}
                </button>
                <span className="text-slate-500">{text.timer}</span>
              </div>

              <div className="border-t border-slate-200 pt-6">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Siguiente paso</p>
                <p className="mt-2 text-sm text-slate-600">Cuando verifiques tu correo, tu cuenta quedará activada.</p>
                <Link
                  href="/register"
                  className="mt-4 inline-flex rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  Volver al registro
                </Link>
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
