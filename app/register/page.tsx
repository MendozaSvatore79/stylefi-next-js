"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";

import GoogleSignInButton from "@/components/google-signin-button";
import { useToast } from "@/components/toast";
import { useLanguage } from "@/lib/language-context";

type TipoCuenta = "cliente" | "negocio";

type RegisterFormState = {
    firstName: string;
    lastName: string;
    businessName: string;
    rfc: string;
    phone: string;
    email: string;
    password: string;
};

export default function Register() {
    const router = useRouter();
    const { showToast } = useToast();
    const { language } = useLanguage();
    const [tipoCuenta, setTipoCuenta] = useState<TipoCuenta>("cliente");
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [profileImage, setProfileImage] = useState<File | null>(null);
    const [form, setForm] = useState<RegisterFormState>({
        firstName: "",
        lastName: "",
        businessName: "",
        rfc: "",
        phone: "",
        email: "",
        password: "",
    });

    const updateField =
        (field: keyof RegisterFormState) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
            setForm((current) => ({
                ...current,
                [field]: event.target.value,
            }));
        };

    const handleAccountTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
        setTipoCuenta(event.target.value as TipoCuenta);
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError("");
        setIsSubmitting(true);

        try {
            const payloadFormData = new FormData();
            payloadFormData.append("accountType", tipoCuenta);
            payloadFormData.append("firstName", form.firstName);
            payloadFormData.append("lastName", form.lastName);
            payloadFormData.append("businessName", form.businessName);
            payloadFormData.append("rfc", form.rfc);
            payloadFormData.append("phone", form.phone);
            payloadFormData.append("email", form.email);
            payloadFormData.append("password", form.password);

            if (profileImage) {
                payloadFormData.append("profileImage", profileImage);
            }

            const response = await fetch("/api/register", {
                method: "POST",
                body: payloadFormData,
            });

            const payload = (await response.json()) as { error?: string; email?: string };

            if (!response.ok) {
                throw new Error(payload.error ?? "No se pudo completar el registro.");
            }

            showToast({
                type: "success",
                title: "Registro completado",
                message: "Te enviamos un OTP por correo.",
            });

            window.setTimeout(() => {
                router.push(`/register/otp?email=${encodeURIComponent(payload.email ?? form.email)}`);
            }, 1000);
        } catch (submitError) {
            showToast({
                type: "error",
                title: "No se pudo completar el registro",
                message: submitError instanceof Error ? submitError.message : "Revisa los datos e inténtalo otra vez.",
            });
            setError(submitError instanceof Error ? submitError.message : "No se pudo completar el registro.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="min-h-screen bg-[#ececef] text-slate-900">
            <header className="w-full border-b border-slate-300 bg-white px-4 py-3 sm:px-8">
                <div className="flex w-full items-center justify-between gap-4">
                    <Link href="/" className="text-3xl font-black tracking-[0.16em] text-[#171135]">
                        STYLEHUB
                    </Link>
                    <nav className="flex items-center gap-2 text-xs font-bold uppercase sm:text-sm">
                        <Link
                            href="/register"
                            className="rounded-full bg-slate-200 px-4 py-2 text-slate-700 transition hover:bg-slate-300"
                        >
                            {language === "en" ? "Sign up" : "Regístrate"}
                        </Link>
                        <Link
                            href="/iniciar-sesion"
                            className="rounded-full bg-[#130b3a] px-4 py-2 text-white transition hover:bg-[#231365]"
                        >
                            {language === "en" ? "Sign in" : "Iniciar sesión"}
                        </Link>
                    </nav>
                </div>
            </header>

            <section className="grid min-h-[calc(100vh-73px)] w-full lg:grid-cols-2">
                <article
                    className="hidden min-h-full bg-cover bg-center lg:block"
                    style={{
                        backgroundImage:
                            "url('https://images.unsplash.com/photo-1622287162716-f311baa1a2b8?auto=format&fit=crop&w=1400&q=80')",
                    }}
                />

                <article className="flex items-start justify-center px-6 pt-10 sm:px-10 lg:justify-end lg:pr-16">
                    <div className="w-full max-w-xl rounded-3xl bg-white p-8 shadow-2xl sm:p-10">
                        <h1 className="text-4xl font-black leading-tight text-[#151138]">
                            {language === "en" ? "Create your account" : "Crea tu cuenta"}
                        </h1>
                        <p className="mt-2 text-sm text-slate-600">
                            {language === "en"
                                ? "Complete your details. When finished, you'll receive an OTP code by email."
                                : "Completa tus datos. Al finalizar recibirás un código OTP por correo electrónico."}
                        </p>

                        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                            {error ? (
                                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                                    {error}
                                </div>
                            ) : null}

                            {step === 1 ? (
                                <>
                                    <label className="block text-sm font-semibold text-slate-700">
                                        {language === "en" ? "Account type" : "Tipo de cuenta"}
                                    </label>
                                    <select
                                        value={tipoCuenta}
                                        onChange={handleAccountTypeChange}
                                        className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium outline-none ring-blue-300 focus:ring"
                                    >
                                        <option value="cliente">{language === "en" ? "Client" : "Cliente"}</option>
                                        <option value="negocio">{language === "en" ? "Business" : "Negocio"}</option>
                                    </select>

                                    {tipoCuenta === "negocio" ? (
                                        <>
                                            <input
                                                type="text"
                                                placeholder="RFC"
                                                value={form.rfc}
                                                onChange={updateField("rfc")}
                                                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-300 focus:ring"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Nombre del negocio"
                                                value={form.businessName}
                                                onChange={updateField("businessName")}
                                                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-300 focus:ring"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Nombre del propietario"
                                                value={form.firstName}
                                                onChange={updateField("firstName")}
                                                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-300 focus:ring"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Apellidos del propietario"
                                                value={form.lastName}
                                                onChange={updateField("lastName")}
                                                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-300 focus:ring"
                                            />
                                        </>
                                    ) : (
                                        <>
                                            <input
                                                type="text"
                                                placeholder="Nombre"
                                                value={form.firstName}
                                                onChange={updateField("firstName")}
                                                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-300 focus:ring"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Apellidos"
                                                value={form.lastName}
                                                onChange={updateField("lastName")}
                                                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-300 focus:ring"
                                            />
                                        </>
                                    )}

                                    <button
                                        type="button"
                                        className="mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-[#130b3a] text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#231365]"
                                        onClick={() => setStep(2)}
                                    >
                                        {language === "en" ? "Next" : "Siguiente"}
                                    </button>

                                    {tipoCuenta === "cliente" ? (
                                        <>
                                            <div className="my-3 flex items-center gap-3 text-xs text-slate-400">
                                                <span className="h-px flex-1 bg-slate-200" />
                                                <span>{language === "en" ? "or continue with" : "o continúa con"}</span>
                                                <span className="h-px flex-1 bg-slate-200" />
                                            </div>

                                            <GoogleSignInButton />

                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <button
                                                    type="button"
                                                    className="h-11 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                                >
                                                    Apple
                                                </button>
                                                <button
                                                    type="button"
                                                    className="h-11 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                                >
                                                    Facebook
                                                </button>
                                            </div>
                                        </>
                                    ) : null}
                                </>
                            ) : null}

                            {step === 2 ? (
                                <>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <input
                                            type="tel"
                                            placeholder="Número de teléfono"
                                            value={form.phone}
                                            onChange={updateField("phone")}
                                            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-300 focus:ring"
                                        />
                                        <input
                                            type="email"
                                            placeholder="Correo electrónico"
                                            value={form.email}
                                            onChange={updateField("email")}
                                            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-300 focus:ring"
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            {language === "en" ? "Profile image" : "Imagen de perfil"}
                                        </label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(event) => setProfileImage(event.target.files?.[0] ?? null)}
                                            className="block w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm text-slate-600"
                                        />
                                    </div>

                                    <input
                                        type="password"
                                        placeholder="Contraseña"
                                        value={form.password}
                                        onChange={updateField("password")}
                                        className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-300 focus:ring"
                                    />

                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-[#130b3a] text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#231365] disabled:cursor-not-allowed disabled:opacity-70"
                                    >
                                        {isSubmitting ? (language === "en" ? "Registering..." : "Registrando...") : (language === "en" ? "Register and send OTP" : "Registrar y enviar OTP")}
                                    </button>

                                    <button
                                        type="button"
                                        className="mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-slate-200 text-sm font-bold uppercase tracking-wide text-slate-700 transition hover:bg-slate-300"
                                        onClick={() => setStep(1)}
                                    >
                                        {language === "en" ? "Back" : "Volver"}
                                    </button>
                                </>
                            ) : null}
                        </form>
                    </div>
                </article>
            </section>
        </main>
    );
}
