"use client";

import { useClerk } from "@clerk/nextjs";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { useToast } from "@/components/toast";
import { useLanguage } from "@/lib/language-context";
import { useCerrarSesion } from "@/lib/sesion-cliente";

type AccountSecurity = {
  email: string;
  accountType: "cliente" | "negocio" | "admin";
  hasGoogle: boolean;
};

type SecurityApiResponse = { error?: string; message?: string };

const ACCESO = {
  es: {
    titulo: "Contraseña y acceso",
    texto: "Tu contraseña, tu correo y las formas de entrar (correo o Google) se administran en tu perfil de acceso.",
    boton: "Administrar mi acceso",
  },
  en: {
    titulo: "Password and access",
    texto: "Your password, email and sign-in methods (email or Google) are managed in your access profile.",
    boton: "Manage my access",
  },
};

/**
 * Seguridad de la cuenta. Contraseña, correo y métodos de acceso: perfil de Clerk (openUserProfile).
 * Eliminar la cuenta: correo escrito + token por correo (lo valida /api/account/security).
 */
export default function AccountSecurityPanel({ title }: { title: string }) {
  const { showToast } = useToast();
  const { t, language } = useLanguage();
  const { openUserProfile } = useClerk();
  const cerrarSesion = useCerrarSesion();
  const acceso = ACCESO[language === "en" ? "en" : "es"];
  const [security, setSecurity] = useState<AccountSecurity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingDeleteToken, setIsSendingDeleteToken] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteForm, setDeleteForm] = useState({ confirmation: "", token: "" });

  const loadSecurity = useCallback(async () => {
    try {
      const response = await fetch("/api/account/security", { cache: "no-store" });
      const payload = (await response.json()) as AccountSecurity & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? t("security.cantLoad"));
      }
      setSecurity(payload);
    } catch (error) {
      showToast({
        type: "error",
        title: t("security.loadErrorTitle"),
        message: error instanceof Error ? error.message : t("security.cantLoad"),
      });
    } finally {
      setIsLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    void loadSecurity();
  }, [loadSecurity]);

  const handleDeleteAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!security || !window.confirm(t("security.deleteConfirm"))) {
      return;
    }
    setIsDeleting(true);
    try {
      const response = await fetch("/api/account/security", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: deleteForm.confirmation, token: deleteForm.token }),
      });
      const payload = (await response.json()) as SecurityApiResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? t("security.cantLoad"));
      }
      showToast({ type: "success", title: t("security.deleteSuccessTitle"), message: t("security.deleteSuccessMsg") });
      await cerrarSesion("/");
    } catch (error) {
      showToast({
        type: "error",
        title: t("security.deleteErrorTitle"),
        message: error instanceof Error ? error.message : t("security.cantLoad"),
      });
      setIsDeleting(false);
    }
  };

  const handleRequestDeleteToken = async () => {
    if (!security) {
      return;
    }
    if (deleteForm.confirmation.trim().toLowerCase() !== security.email.toLowerCase()) {
      showToast({ type: "error", title: t("security.confirmEmail"), message: t("security.confirmEmailText") });
      return;
    }
    setIsSendingDeleteToken(true);
    try {
      const response = await fetch("/api/account/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: deleteForm.confirmation }),
      });
      const payload = (await response.json()) as SecurityApiResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? t("security.sendTokenError"));
      }
      showToast({ type: "success", title: t("security.tokenSentTitle"), message: payload.message ?? t("security.tokenSentMsg") });
    } catch (error) {
      showToast({
        type: "error",
        title: t("security.tokenErrorTitle"),
        message: error instanceof Error ? error.message : t("security.cantLoad"),
      });
    } finally {
      setIsSendingDeleteToken(false);
    }
  };

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{t("settings.security")}</p>
      <h2 className="mt-2 text-2xl font-black text-[#151138]">{title}</h2>

      {isLoading ? <p className="mt-4 text-sm text-slate-600">{t("security.loading")}</p> : null}

      {security ? (
        <>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p>
              {t("security.email")}: <span className="font-semibold">{security.email}</span>
            </p>
            <p className="mt-1">
              {t("security.accessMethod")}: {security.hasGoogle ? t("security.accessGoogle") : t("security.accessPassword")}
            </p>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-800">{acceso.titulo}</p>
            <p className="mt-1 text-xs text-slate-600">{acceso.texto}</p>
            <button
              type="button"
              onClick={() => openUserProfile()}
              className="mt-3 inline-flex h-10 items-center justify-center rounded-xl bg-[#151138] px-4 text-sm font-semibold text-white transition hover:opacity-90"
            >
              {acceso.boton}
            </button>
          </div>

          <form className="mt-8 space-y-3 rounded-2xl border border-rose-200 bg-rose-50 p-4" onSubmit={handleDeleteAccount}>
            <p className="text-sm font-bold text-rose-700">{t("security.dangerZone")}</p>
            <p className="text-xs text-rose-700">{t("security.dangerText")}</p>

            <input
              value={deleteForm.confirmation}
              onChange={(event) => setDeleteForm((current) => ({ ...current, confirmation: event.target.value }))}
              placeholder={`${t("security.confirmEmailPlaceholder")} ${security.email}`}
              className="h-11 w-full rounded-xl border border-rose-200 bg-white px-3 text-sm outline-none ring-rose-300 focus:ring"
            />

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleRequestDeleteToken}
                disabled={isSendingDeleteToken}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-rose-300 bg-white px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSendingDeleteToken ? t("security.deleting") : t("security.sendDeleteToken")}
              </button>
              <p className="text-xs text-rose-700">{t("security.deleteTokenHint")}</p>
            </div>

            <input
              value={deleteForm.token}
              onChange={(event) => setDeleteForm((current) => ({ ...current, token: event.target.value }))}
              inputMode="numeric"
              maxLength={6}
              placeholder={t("security.deleteTokenPlaceholder")}
              className="h-11 w-full rounded-xl border border-rose-200 bg-white px-3 text-sm outline-none ring-rose-300 focus:ring"
            />

            <button
              type="submit"
              disabled={isDeleting}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-rose-600 px-5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isDeleting ? t("security.deleting") : t("security.deleteForever")}
            </button>
          </form>
        </>
      ) : null}
    </article>
  );
}
