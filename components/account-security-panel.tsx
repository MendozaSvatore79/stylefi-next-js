"use client";

import { useEffect, useState, type FormEvent } from "react";
import { signOut } from "next-auth/react";

import { useToast } from "@/components/toast";
import { useLanguage } from "@/lib/language-context";

type AccountSecurity = {
  email: string;
  accountType: "cliente" | "negocio";
  hasPassword: boolean;
  hasGoogle: boolean;
  providers: string[];
};

export default function AccountSecurityPanel({ title }: { title: string }) {
  const { showToast } = useToast();
  const { t } = useLanguage();
  const [security, setSecurity] = useState<AccountSecurity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isSendingDeleteToken, setIsSendingDeleteToken] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [deleteForm, setDeleteForm] = useState({
    confirmation: "",
    token: "",
  });

  const loadSecurity = async () => {
    try {
      const response = await fetch("/api/account/security", { cache: "no-store" });
      const payload = (await response.json()) as AccountSecurity & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo cargar seguridad de cuenta.");
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
  };

  useEffect(() => {
    void loadSecurity();
  }, []);

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast({
        type: "error",
        title: t("security.badPasswordTitle"),
        message: t("security.badPasswordMatch"),
      });
      return;
    }

    setIsSavingPassword(true);

    try {
      const response = await fetch("/api/account/security", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      const payload = (await response.json()) as { error?: string; mode?: "updated" | "created" };
      if (!response.ok) {
        throw new Error(payload.error ?? t("security.saveError"));
      }

      showToast({
        type: "success",
        title: payload.mode === "created" ? t("security.savedSuccessCreated") : t("security.savedSuccessUpdated"),
        message:
          payload.mode === "created"
            ? t("security.savedSuccessCreatedMsg")
            : t("security.savedSuccessUpdatedMsg"),
      });

      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      await loadSecurity();
    } catch (error) {
      showToast({
        type: "error",
        title: t("security.savedErrorTitle"),
        message: error instanceof Error ? error.message : t("security.cantLoad"),
      });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleDeleteAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!security) {
      return;
    }

    const confirmed = window.confirm(t("security.deleteConfirm"));
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch("/api/account/security", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmation: deleteForm.confirmation,
          token: deleteForm.token,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo eliminar la cuenta.");
      }

      showToast({
        type: "success",
        title: t("security.deleteSuccessTitle"),
        message: t("security.deleteSuccessMsg"),
      });

      await signOut({ callbackUrl: "/" });
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
      showToast({
        type: "error",
        title: t("security.confirmEmail"),
        message: t("security.confirmEmailText"),
      });
      return;
    }

    setIsSendingDeleteToken(true);

    try {
      const response = await fetch("/api/account/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmation: deleteForm.confirmation,
        }),
      });

      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? t("security.sendTokenError"));
      }

      showToast({
        type: "success",
        title: t("security.tokenSentTitle"),
        message: payload.message ?? t("security.tokenSentMsg"),
      });
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
              {security.hasGoogle && security.hasPassword ? t("security.googleWithPassword") : ""}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {security.hasGoogle
                ? t("security.accountType")
                : t("security.noAccountType")}
            </p>
          </div>

          <form className="mt-6 space-y-3" onSubmit={handlePasswordSubmit}>
            <p className="text-sm font-semibold text-slate-800">
              {security.hasPassword ? t("security.changePassword") : t("security.createPassword")}
            </p>

            {security.hasPassword ? (
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) =>
                  setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))
                }
                placeholder={t("security.currentPassword")}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-indigo-300 focus:ring"
              />
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                placeholder={t("security.newPassword")}
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-indigo-300 focus:ring"
              />
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) =>
                  setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))
                }
                placeholder={t("security.confirmPassword")}
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-indigo-300 focus:ring"
              />
            </div>

            <button
              type="submit"
              disabled={isSavingPassword}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSavingPassword ? t("security.savePassword") : security.hasPassword ? t("security.updatePassword") : t("security.createPasswordAction")}
            </button>
          </form>

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