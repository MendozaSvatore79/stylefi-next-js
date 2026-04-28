"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useEffect, useState, type FormEvent } from "react";

import GoogleSignInButton from "@/components/google-signin-button";
import { useToast } from "@/components/toast";
import { useLanguage } from "@/lib/language-context";

const copy = {
  es: {
    googleUnavailableTitle: "Google no disponible",
    googleUnavailableMsg: "Google ahora inicia sesión para todos. Si tu cuenta aún no existe, completarás un perfil rápido después de entrar.",
    loginErrorFallback: "No se pudo iniciar sesión.",
    loginSessionError: "No se pudo crear la sesión. Intenta de nuevo.",
    loginSuccessTitle: "Inicio de sesión exitoso",
    loginSuccessMsg: "Entrando a tu panel...",
    loginErrorTitle: "No se pudo iniciar sesión",
    loginErrorMsg: "Revisa tus datos e inténtalo otra vez.",
    brand: "STYLEHUB",
    register: "Regístrate",
    section: "Inicio de sesión",
    title: "Bienvenido de nuevo",
    subtitle: "Accede como cliente, negocio o administrador.",
    email: "Correo electrónico",
    password: "Contraseña",
    emailPlaceholder: "correo@ejemplo.com",
    loginButton: "Iniciar sesión",
    loggingIn: "Ingresando...",
    forgot: "Olvidé mi contraseña",
    orContinue: "o continúa con",
    googleNote: "Google ahora funciona para clientes y negocios. Si no existes en la base de datos, completarás tu perfil al entrar.",
    noAccount: "¿No tienes cuenta?",
    createAccount: "Crea tu cuenta",
  },
  en: {
    googleUnavailableTitle: "Google unavailable",
    googleUnavailableMsg: "Google now signs in everyone. If your account does not exist yet, you'll complete a quick profile after signing in.",
    loginErrorFallback: "Could not sign in.",
    loginSessionError: "Could not create the session. Try again.",
    loginSuccessTitle: "Sign-in successful",
    loginSuccessMsg: "Opening your dashboard...",
    loginErrorTitle: "Could not sign in",
    loginErrorMsg: "Check your details and try again.",
    brand: "STYLEHUB",
    register: "Sign up",
    section: "Sign in",
    title: "Welcome back",
    subtitle: "Sign in as a client, business, or admin.",
    email: "Email address",
    password: "Password",
    emailPlaceholder: "email@example.com",
    loginButton: "Sign in",
    loggingIn: "Signing in...",
    forgot: "I forgot my password",
    orContinue: "or continue with",
    googleNote: "Google now works for clients and businesses. If you do not exist in the database, you'll complete your profile after signing in.",
    noAccount: "Don't have an account?",
    createAccount: "Create your account",
  },
} as const;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { language } = useLanguage();
  const text = language === "en" ? copy.en : copy.es;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showUnauthorizedAccessMessage, setShowUnauthorizedAccessMessage] = useState(false);

  const unauthorizedAccessMessage = language === "en" ? "Unauthorized access, please sign in." : "acceso no autorizado por favor inicia sesion";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (searchParams.get("reason") === "unauthorized") {
      setShowUnauthorizedAccessMessage(true);

      const params = new URLSearchParams(searchParams.toString());
      params.delete("reason");
      const nextQuery = params.toString();
      router.replace(nextQuery ? `/iniciar-sesion?${nextQuery}` : "/iniciar-sesion");
    }

    if (searchParams.get("error") === "google_client_only") {
      showToast({
        type: "error",
        title: text.googleUnavailableTitle,
        message: text.googleUnavailableMsg,
      });

      const params = new URLSearchParams(searchParams.toString());
      params.delete("error");
      const nextQuery = params.toString();
      router.replace(nextQuery ? `/iniciar-sesion?${nextQuery}` : "/iniciar-sesion");
    }
  }, [router, searchParams, showToast, text.googleUnavailableMsg, text.googleUnavailableTitle]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const payload = (await response.json()) as {
        error?: string;
        redirectTo?: string;
        message?: string;
        role?: "admin" | "cliente" | "negocio";
      };

      if (!response.ok) {
        throw new Error(payload.error ?? text.loginErrorFallback);
      }

      if (payload.role !== "admin") {
        const authResult = await signIn("credentials", {
          email,
          password,
          redirect: false,
          callbackUrl: payload.redirectTo ?? "/",
        });

        if (authResult?.error) {
          throw new Error(text.loginSessionError);
        }
      }

      showToast({
        type: "success",
        title: text.loginSuccessTitle,
        message: payload.message ?? text.loginSuccessMsg,
      });

      window.setTimeout(() => {
        router.push(payload.redirectTo ?? "/");
      }, 900);
    } catch (loginError) {
      showToast({
        type: "error",
        title: text.loginErrorTitle,
        message: loginError instanceof Error ? loginError.message : text.loginErrorMsg,
      });
      setError(loginError instanceof Error ? loginError.message : text.loginErrorFallback);
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
            href="/register"
            className="rounded-full bg-slate-200 px-4 py-2 text-xs font-bold uppercase text-slate-700 transition hover:bg-slate-300 sm:text-sm"
          >
            {text.register}
          </Link>
        </div>
      </header>

      <section className="grid min-h-[calc(100vh-73px)] w-full lg:grid-cols-2">
        <article
          className="hidden min-h-full bg-cover bg-center lg:block"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=1200&q=80')",
          }}
        />

        <article className="flex items-center justify-center px-6 py-10 sm:px-10 lg:justify-end lg:pr-24">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{text.section}</p>
            <h1 className="mt-2 text-4xl font-black leading-tight text-[#151138]">{text.title}</h1>
            <p className="mt-3 text-sm text-slate-600">{text.subtitle}</p>

            {showUnauthorizedAccessMessage ? (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                {unauthorizedAccessMessage}
              </div>
            ) : null}

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
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

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">{text.password}</label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-blue-300 focus:ring"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-[#130b3a] text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#231365] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? text.loggingIn : text.loginButton}
              </button>

              <div className="text-right text-sm">
                <Link href="/olvido-contrasena" className="font-semibold text-blue-700 hover:underline">
                  {text.forgot}
                </Link>
              </div>

              <div className="my-1 flex items-center gap-3 text-xs text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />
                <span>{text.orContinue}</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              <GoogleSignInButton />

              <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
                {text.googleNote}
              </p>

              <div className="border-t border-slate-200 pt-6">
                <p className="text-sm text-slate-600">
                  {text.noAccount}{" "}
                  <Link href="/register" className="font-semibold text-blue-700 hover:underline">
                    {text.createAccount}
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </article>
      </section>
    </main>
  );
}
