"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { signOut } from "next-auth/react";

import { useToast } from "@/components/toast";
import { useLanguage } from "@/lib/language-context";

type TwoFactorState = {
  enabled: boolean;
  preferredMethod: "email" | "authenticator" | null;
  hasAuthenticator: boolean;
  reverifyIntervalMinutes: number;
  lastVerifiedAt: string | null;
  requiresVerification: boolean;
};

type AccountSecurity = {
  email: string;
  accountType: "cliente" | "negocio";
  hasPassword: boolean;
  hasGoogle: boolean;
  providers: string[];
  twoFactor: TwoFactorState;
};

type TwoFactorPurpose = "enable_email" | "enable_authenticator" | "verify_session" | "disable";

type SecurityApiResponse = {
  error?: string;
  code?: string;
  message?: string;
  mode?: "updated" | "created";
  twoFactor?: TwoFactorState;
  destination?: string;
  challengeId?: string;
  setupId?: string;
  challengeToken?: string;
  manualKey?: string;
  qrDataUrl?: string;
};

export default function AccountSecurityPanel({ title }: { title: string }) {
  const { showToast } = useToast();
  const { t } = useLanguage();
  const [security, setSecurity] = useState<AccountSecurity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isSendingDeleteToken, setIsSendingDeleteToken] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTwoFactorBusy, setIsTwoFactorBusy] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [deleteForm, setDeleteForm] = useState({
    confirmation: "",
    token: "",
  });
  const [twoFactorMethod, setTwoFactorMethod] = useState<"email" | "authenticator">("email");
  const [twoFactorPurpose, setTwoFactorPurpose] = useState<TwoFactorPurpose>("verify_session");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorChallengeId, setTwoFactorChallengeId] = useState<string | null>(null);
  const [twoFactorChallengeToken, setTwoFactorChallengeToken] = useState<string | null>(null);
  const [twoFactorQrDataUrl, setTwoFactorQrDataUrl] = useState<string | null>(null);
  const [twoFactorManualKey, setTwoFactorManualKey] = useState<string | null>(null);
  const [twoFactorDestination, setTwoFactorDestination] = useState<string | null>(null);
  const [reverifyIntervalMinutes, setReverifyIntervalMinutes] = useState(180);

  const loadSecurity = useCallback(async () => {
    try {
      const response = await fetch("/api/account/security", { cache: "no-store" });
      const payload = (await response.json()) as AccountSecurity & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo cargar seguridad de cuenta.");
      }

      setSecurity(payload);
      setTwoFactorMethod(payload.twoFactor.preferredMethod ?? "email");
      setReverifyIntervalMinutes(payload.twoFactor.reverifyIntervalMinutes ?? 180);
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

  const applyTwoFactorUpdate = async (payload?: SecurityApiResponse) => {
    if (payload?.twoFactor && security) {
      setSecurity({ ...security, twoFactor: payload.twoFactor });
      setTwoFactorMethod(payload.twoFactor.preferredMethod ?? "email");
      setReverifyIntervalMinutes(payload.twoFactor.reverifyIntervalMinutes ?? 180);
    } else {
      await loadSecurity();
    }
  };

  const handleTwoFactorRequired = async (payload?: SecurityApiResponse) => {
    setTwoFactorPurpose("verify_session");
    const methodFromServer = payload?.twoFactor?.preferredMethod;
    const method = methodFromServer === "authenticator" ? "authenticator" : "email";
    setTwoFactorMethod(method);

    showToast({
      type: "info",
      title: "Verificación 2FA requerida",
      message: "Confirma tu código 2FA para continuar con esta acción.",
    });

    if (method === "email") {
      await requestTwoFactorEmailCode("verify_session");
    }
  };

  const requestTwoFactorEmailCode = async (purpose: TwoFactorPurpose) => {
    setIsTwoFactorBusy(true);
    try {
      const response = await fetch("/api/account/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "twoFactorSendEmailCode",
          purpose,
        }),
      });

      const payload = (await response.json()) as SecurityApiResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo enviar el código 2FA.");
      }

      setTwoFactorPurpose(purpose);
      setTwoFactorMethod("email");
      setTwoFactorCode("");
      setTwoFactorChallengeId(payload.challengeId ?? null);
      setTwoFactorDestination(payload.destination ?? null);
      setTwoFactorQrDataUrl(null);
      setTwoFactorManualKey(null);
      showToast({
        type: "success",
        title: "Código 2FA enviado",
        message: payload.destination
          ? `Revisa tu correo (${payload.destination}).`
          : "Revisa tu correo para continuar.",
      });
    } catch (error) {
      showToast({
        type: "error",
        title: "Error enviando código",
        message: error instanceof Error ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setIsTwoFactorBusy(false);
    }
  };

  const handleGenerateAuthenticatorQr = async () => {
    setIsTwoFactorBusy(true);
    try {
      const response = await fetch("/api/account/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "twoFactorCreateAuthenticatorSetup",
        }),
      });

      const payload = (await response.json()) as SecurityApiResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo generar el QR de autenticador.");
      }

      setTwoFactorPurpose("enable_authenticator");
      setTwoFactorMethod("authenticator");
      setTwoFactorCode("");
      setTwoFactorChallengeId(payload.setupId ?? null);
      setTwoFactorChallengeToken(payload.challengeToken ?? null);
      setTwoFactorQrDataUrl(payload.qrDataUrl ?? null);
      setTwoFactorManualKey(payload.manualKey ?? null);
      showToast({
        type: "success",
        title: "QR generado",
        message: "Escanea el QR con Google Authenticator o tu app MFA.",
      });
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudo generar QR",
        message: error instanceof Error ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setIsTwoFactorBusy(false);
    }
  };

  const handleVerifyTwoFactor = async () => {
    setIsTwoFactorBusy(true);
    try {
      const response = await fetch("/api/account/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "twoFactorVerify",
          method: twoFactorMethod,
          purpose: twoFactorPurpose,
          code: twoFactorCode,
          challengeId: twoFactorChallengeId,
          challengeToken: twoFactorChallengeToken,
        }),
      });

      const payload = (await response.json()) as SecurityApiResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo validar el código 2FA.");
      }

      await applyTwoFactorUpdate(payload);
      setTwoFactorCode("");
      setTwoFactorChallengeId(null);
      setTwoFactorChallengeToken(null);
      setTwoFactorDestination(null);

      if (twoFactorPurpose === "disable") {
        setTwoFactorQrDataUrl(null);
        setTwoFactorManualKey(null);
      }

      showToast({
        type: "success",
        title: "Verificación correcta",
        message:
          twoFactorPurpose === "enable_authenticator" || twoFactorPurpose === "enable_email"
            ? "La verificación en dos pasos quedó activada."
            : twoFactorPurpose === "disable"
              ? "La verificación en dos pasos quedó desactivada."
              : "Tu sesión quedó verificada.",
      });
    } catch (error) {
      showToast({
        type: "error",
        title: "Código inválido",
        message: error instanceof Error ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setIsTwoFactorBusy(false);
    }
  };

  const handleSaveTwoFactorPreferences = async () => {
    setIsTwoFactorBusy(true);
    try {
      const response = await fetch("/api/account/security", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "twoFactorPreferences",
          preferredMethod: twoFactorMethod,
          reverifyIntervalMinutes,
        }),
      });

      const payload = (await response.json()) as SecurityApiResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo actualizar la configuración 2FA.");
      }

      await applyTwoFactorUpdate(payload);
      showToast({
        type: "success",
        title: "2FA actualizado",
        message: "Guardamos tu método e intervalo de verificación.",
      });
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudo guardar 2FA",
        message: error instanceof Error ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setIsTwoFactorBusy(false);
    }
  };

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

      const payload = (await response.json()) as SecurityApiResponse;
      if (!response.ok) {
        if (payload.code === "two_factor_required") {
          await handleTwoFactorRequired(payload);
          return;
        }

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

      const payload = (await response.json()) as SecurityApiResponse;
      if (!response.ok) {
        if (payload.code === "two_factor_required") {
          await handleTwoFactorRequired(payload);
          return;
        }

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

      const payload = (await response.json()) as SecurityApiResponse;
      if (!response.ok) {
        if (payload.code === "two_factor_required") {
          await handleTwoFactorRequired(payload);
          return;
        }

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
              {security.hasGoogle ? t("security.accountType") : t("security.noAccountType")}
            </p>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-800">Verificación en dos pasos (2FA)</p>
                <p className="text-xs text-slate-600">
                  {security.twoFactor.enabled
                    ? `Activa (${security.twoFactor.preferredMethod === "authenticator" ? "app autenticadora" : "correo"})`
                    : "Actualmente desactivada"}
                </p>
                {security.twoFactor.lastVerifiedAt ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Última verificación: {new Date(security.twoFactor.lastVerifiedAt).toLocaleString("es-MX")}
                  </p>
                ) : null}
              </div>
              {security.twoFactor.requiresVerification ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  Requiere re-verificación
                </span>
              ) : null}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setTwoFactorMethod("email")}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  twoFactorMethod === "email" ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                Código al correo
              </button>
              <button
                type="button"
                onClick={() => setTwoFactorMethod("authenticator")}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  twoFactorMethod === "authenticator" ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                Google Authenticator / MFA
              </button>
            </div>

            {security.twoFactor.enabled ? (
              <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                  <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Pedir código cada</label>
                  <select
                    value={reverifyIntervalMinutes}
                    onChange={(event) => setReverifyIntervalMinutes(Number(event.target.value))}
                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  >
                    <option value={30}>30 minutos</option>
                    <option value={60}>1 hora</option>
                    <option value={180}>3 horas</option>
                    <option value={360}>6 horas</option>
                    <option value={720}>12 horas</option>
                    <option value={1440}>24 horas</option>
                  </select>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveTwoFactorPreferences()}
                    disabled={isTwoFactorBusy}
                    className="inline-flex h-10 items-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-70"
                  >
                    Guardar preferencias 2FA
                  </button>

                  {twoFactorMethod === "email" ? (
                    <button
                      type="button"
                      onClick={() => void requestTwoFactorEmailCode("verify_session")}
                      disabled={isTwoFactorBusy}
                      className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-70"
                    >
                      Verificar sesión por correo
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setTwoFactorPurpose("verify_session");
                        setTwoFactorMethod("authenticator");
                      }}
                      className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Verificar sesión con app
                    </button>
                  )}

                  {twoFactorMethod === "email" ? (
                    <button
                      type="button"
                      onClick={() => void requestTwoFactorEmailCode("disable")}
                      disabled={isTwoFactorBusy}
                      className="inline-flex h-10 items-center rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-70"
                    >
                      Enviar código para desactivar 2FA
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setTwoFactorPurpose("disable");
                        setTwoFactorMethod("authenticator");
                      }}
                      className="inline-flex h-10 items-center rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                    >
                      Desactivar 2FA con app
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-3">
                {twoFactorMethod === "email" ? (
                  <button
                    type="button"
                    onClick={() => void requestTwoFactorEmailCode("enable_email")}
                    disabled={isTwoFactorBusy}
                    className="inline-flex h-10 items-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-70"
                  >
                    Activar 2FA por correo
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleGenerateAuthenticatorQr()}
                    disabled={isTwoFactorBusy}
                    className="inline-flex h-10 items-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-70"
                  >
                    Generar QR para Google Authenticator
                  </button>
                )}

                {twoFactorQrDataUrl ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-600">Escanea este QR con tu app autenticadora:</p>
                    <Image
                      src={twoFactorQrDataUrl}
                      alt="QR para vincular autenticador"
                      width={176}
                      height={176}
                      unoptimized
                      className="mt-2 h-44 w-44 rounded-lg border border-slate-200 bg-white p-2"
                    />
                    {twoFactorManualKey ? (
                      <p className="mt-2 text-xs text-slate-600 break-all">
                        Clave manual: <span className="font-semibold text-slate-800">{twoFactorManualKey}</span>
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}

            {(twoFactorChallengeId || security.twoFactor.enabled || security.twoFactor.requiresVerification) ? (
              <div className="mt-3 space-y-2">
                {twoFactorDestination ? <p className="text-xs text-slate-500">Código enviado a {twoFactorDestination}</p> : null}
                <input
                  value={twoFactorCode}
                  onChange={(event) => setTwoFactorCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Código 2FA de 6 dígitos"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-indigo-300 focus:ring"
                />
                <button
                  type="button"
                  onClick={() => void handleVerifyTwoFactor()}
                  disabled={isTwoFactorBusy || twoFactorCode.length !== 6}
                  className="inline-flex h-10 items-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-70"
                >
                  Verificar código 2FA
                </button>
              </div>
            ) : null}
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
