"use client";

import { useEffect, useState, type FormEvent } from "react";

import { useToast } from "@/components/toast";
import { useLanguage } from "@/lib/language-context";
import StripeCardSetupForm from "./StripeCardSetupForm";

type PaymentMethod = {
  id: string;
  provider: "card" | "transfer" | "cash" | "wallet" | "paypal";
  card_brand: string | null;
  card_last4: string | null;
  holder_name: string | null;
  paypal_email: string | null;
  is_default: boolean;
};

type Wallet = {
  id: string;
  balance: string;
  currency: string;
};

type WalletTransaction = {
  id: string;
  transaction_type: "recharge" | "debit" | "refund";
  amount: string;
  payment_provider: string | null;
  status: "pending" | "completed" | "failed";
  notes: string | null;
  created_at: string;
};

export default function ClientePagosPage() {
  const { showToast } = useToast();
  const { t, language } = useLanguage();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecharging, setIsRecharging] = useState(false);
  const [isSavingMethod, setIsSavingMethod] = useState(false);
  const [deletingMethodId, setDeletingMethodId] = useState<string | null>(null);
  const [editingMethodId, setEditingMethodId] = useState<string | null>(null);
  const [editHolderName, setEditHolderName] = useState("");
  const [editPaypalEmail, setEditPaypalEmail] = useState("");
  const [editIsDefault, setEditIsDefault] = useState(false);
  const [isClearingRecharges, setIsClearingRecharges] = useState(false);
  const [confirmedSessionId, setConfirmedSessionId] = useState<string | null>(null);
  const [form, setForm] = useState({
    provider: "card" as "card" | "paypal" | "transfer" | "cash" | "wallet",
    holderName: "",
    paypalEmail: "",
    isDefault: true,
  });
  const [recharge, setRecharge] = useState({
    amount: "",
    paymentMethodId: "",
  });

  const loadMethods = async () => {
    try {
      const response = await fetch("/api/client/payment-methods", { cache: "no-store" });
      const payload = (await response.json()) as {
        methods?: PaymentMethod[];
        wallet?: Wallet;
        transactions?: WalletTransaction[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudieron cargar los métodos de pago.");
      }

      setMethods(payload.methods ?? []);
      setWallet(payload.wallet ?? null);
      setTransactions(payload.transactions ?? []);
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudieron cargar métodos",
        message: error instanceof Error ? error.message : "Inténtalo de nuevo.",
      });
      setMethods([]);
    }
  };

  useEffect(() => {
    void loadMethods();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rechargeStatus = params.get("recharge");
    const sessionId = params.get("session_id");

    if (rechargeStatus !== "success" || !sessionId || confirmedSessionId === sessionId) {
      return;
    }

    const confirmRecharge = async () => {
      try {
        const response = await fetch("/api/client/wallet/recharge/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        const payload = (await response.json()) as { error?: string; alreadyCompleted?: boolean };

        if (!response.ok) {
          throw new Error(payload.error ?? "No se pudo confirmar la recarga.");
        }

        setConfirmedSessionId(sessionId);
        await loadMethods();

        showToast({
          type: "success",
          title: payload.alreadyCompleted ? t("payments.successRecharge") : t("payments.successRecharge"),
          message: payload.alreadyCompleted
            ? "La recarga ya estaba confirmada en tu wallet."
            : "Tu recarga fue confirmada y acreditada a tu wallet.",
        });

        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete("recharge");
        cleanUrl.searchParams.delete("session_id");
        window.history.replaceState({}, "", cleanUrl.toString());
      } catch (error) {
        showToast({
          type: "error",
          title: t("payments.errorRecharge"),
          message: error instanceof Error ? error.message : t("payments.errorRecharge.desc"),
        });
      }
    };

    void confirmRecharge();
  }, [confirmedSessionId, showToast]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (form.provider === "card") {
      showToast({
        type: "info",
        title: t("payments.cardLabel"),
        message: t("payments.cardDesc"),
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/client/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: form.provider,
          holderName: form.holderName,
          paypalEmail: form.paypalEmail,
          isDefault: form.isDefault,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo guardar el método de pago.");
      }

      showToast({
        type: "success",
        title: t("payments.successAdd"),
        message: t("payments.successAdd.desc"),
      });

      setForm({ provider: "card", holderName: "", paypalEmail: "", isDefault: true });
      await loadMethods();
    } catch (error) {
      showToast({
        type: "error",
        title: t("payments.errorAdd"),
        message: error instanceof Error ? error.message : t("payments.errorLoadRetry"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecharge = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsRecharging(true);

    try {
      const amount = Number(recharge.amount);
      const response = await fetch("/api/client/wallet/recharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          paymentMethodId: recharge.paymentMethodId || undefined,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        checkoutUrl?: string;
        mode?: "mock" | "stripe-direct" | "stripe";
        wallet?: { balance: string; currency: string };
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo recargar la wallet.");
      }

      // Caso 1: Pago directo exitoso (tarjeta guardada o mock)
      if (payload.mode === "stripe-direct" || payload.mode === "mock") {
        showToast({
          type: "success",
          title: "¡Recarga completada!",
          message: `Se agregaron $${amount.toFixed(2)} a tu wallet.`,
        });
        setRecharge({ amount: "", paymentMethodId: "" });
        await loadMethods(); // Recargar estado
        return;
      }

      // Caso 2: Checkout de Stripe (tarjeta nueva)
      if (payload.checkoutUrl) {
        window.location.href = payload.checkoutUrl;
        return;
      }

      throw new Error("No se pudo procesar la recarga: respuesta incompleta del servidor.");
    } catch (error) {
      const message = error instanceof Error ? error.message : t("payments.errorLoadRetry");
      showToast({
        type: "error",
        title: t("payments.errorRecharge"),
        message: message.includes("STRIPE_SECRET_KEY") || message.includes("Stripe no configurados")
          ? "Recarga real deshabilitada: falta configurar Stripe en el servidor."
          : message,
      });
    } finally {
      setIsRecharging(false);
    }
  };

  const startEditMethod = (method: PaymentMethod) => {
    setEditingMethodId(method.id);
    setEditHolderName(method.holder_name || "");
    setEditPaypalEmail(method.paypal_email || "");
    setEditIsDefault(method.is_default);
  };

  const cancelEditMethod = () => {
    setEditingMethodId(null);
    setEditHolderName("");
    setEditPaypalEmail("");
    setEditIsDefault(false);
  };

  const saveEditMethod = async (methodId: string) => {
    setIsSavingMethod(true);
    try {
      const response = await fetch("/api/client/payment-methods", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          methodId,
          holderName: editHolderName,
          paypalEmail: editPaypalEmail,
          isDefault: editIsDefault,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo editar el método.");
      }

      showToast({
        type: "success",
        title: "Método actualizado",
        message: "Los cambios se guardaron correctamente.",
      });

      cancelEditMethod();
      await loadMethods();
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudo editar",
        message: error instanceof Error ? error.message : "Inténtalo de nuevo.",
      });
    } finally {
      setIsSavingMethod(false);
    }
  };

  const deleteMethod = async (methodId: string) => {
    setDeletingMethodId(methodId);
    try {
      const response = await fetch("/api/client/payment-methods", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ methodId }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo eliminar el método.");
      }

      showToast({
        type: "success",
        title: "Método eliminado",
        message: "Se eliminó correctamente.",
      });

      if (editingMethodId === methodId) {
        cancelEditMethod();
      }
      await loadMethods();
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudo eliminar",
        message: error instanceof Error ? error.message : "Inténtalo de nuevo.",
      });
    } finally {
      setDeletingMethodId(null);
    }
  };

  const clearRechargeRecords = async () => {
    const confirmed = window.confirm("¿Seguro que quieres limpiar los registros de recargas? Esta acción no cambia tu saldo.");
    if (!confirmed) {
      return;
    }

    setIsClearingRecharges(true);
    try {
      const response = await fetch("/api/client/wallet/recharges", { method: "DELETE" });
      const payload = (await response.json()) as { error?: string; deletedCount?: number };

      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudieron limpiar los registros.");
      }

      showToast({
        type: "success",
        title: "Registros limpiados",
        message: `Se eliminaron ${payload.deletedCount ?? 0} recargas del historial.`,
      });

      await loadMethods();
    } catch (error) {
      showToast({
        type: "error",
        title: "No se pudo limpiar",
        message: error instanceof Error ? error.message : "Inténtalo de nuevo.",
      });
    } finally {
      setIsClearingRecharges(false);
    }
  };

  return (
    <section className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
      <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{t("payments.section")}</p>
        <h2 className="mt-2 text-2xl font-black text-[#151138]">{t("payments.title")}</h2>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">{t("payments.type")}</label>
            <select
              value={form.provider}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  provider: event.target.value as "card" | "paypal" | "transfer" | "cash" | "wallet",
                }))
              }
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-indigo-300 focus:ring"
            >
              <option value="card">{t("payments.card")}</option>
              <option value="paypal">{t("payments.paypal")}</option>
              <option value="transfer">{t("payments.transfer")}</option>
              <option value="cash">{t("payments.cash")}</option>
              <option value="wallet">{t("payments.wallet")}</option>
            </select>
          </div>

          {form.provider === "card" ? (
            <div className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
              <p className="text-sm font-semibold text-[#151138]">{t("payments.secureCardTitle")}</p>
              <p className="text-xs text-slate-600">{t("payments.secureCardDesc")}</p>
              <StripeCardSetupForm
                onSuccess={async () => {
                  showToast({
                    type: "success",
                    title: t("payments.cardSaved"),
                    message: t("payments.cardSavedDesc"),
                  });
                  await loadMethods();
                }}
              />
            </div>
          ) : null}

          {form.provider !== "card" ? (
            <form className="space-y-4" onSubmit={handleSubmit}>
              {form.provider === "paypal" ? (
                <input
                  value={form.paypalEmail}
                  onChange={(event) => setForm((current) => ({ ...current, paypalEmail: event.target.value }))}
                  placeholder="Correo PayPal"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-indigo-300 focus:ring"
                />
              ) : null}

              <input
                value={form.holderName}
                onChange={(event) => setForm((current) => ({ ...current, holderName: event.target.value }))}
                placeholder="Titular"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-indigo-300 focus:ring"
              />

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(event) => setForm((current) => ({ ...current, isDefault: event.target.checked }))}
                />
                {language === "en" ? "Mark as default payment method" : "Marcar como método predeterminado"}
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-[#130b3a] px-5 text-sm font-semibold text-white transition hover:bg-[#231365] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? (language === "en" ? "Saving..." : "Guardando...") : (language === "en" ? "Save method" : "Guardar método")}
              </button>
            </form>
          ) : null}
        </div>
      </article>

      <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{language === "en" ? "Wallet" : "Wallet"}</p>
        <h2 className="mt-2 text-2xl font-black text-[#151138]">{language === "en" ? "Balance and recharges" : "Saldo y recargas"}</h2>
        <p className="mt-2 text-sm text-slate-600">
          {language === "en" ? "Current balance: " : "Saldo actual: "}<span className="font-black text-emerald-700">${Number(wallet?.balance ?? 0).toFixed(2)} {wallet?.currency ?? "MXN"}</span>
        </p>
        <p className="mt-1 text-xs text-slate-500">{language === "en" ? "The recharge is credited when Stripe confirms the payment." : "La recarga se acredita cuando Stripe confirma el pago."}</p>

        <form className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4" onSubmit={handleRecharge}>
          <input
            type="number"
            min={10}
            max={10000}
            step="0.01"
            value={recharge.amount}
            onChange={(event) => setRecharge((current) => ({ ...current, amount: event.target.value }))}
            placeholder={language === "en" ? "Amount to recharge (min. $10)" : "Monto a recargar (mín. $10)"}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-emerald-300 focus:ring"
          />

          <select
            value={recharge.paymentMethodId}
            onChange={(event) => setRecharge((current) => ({ ...current, paymentMethodId: event.target.value }))}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-emerald-300 focus:ring"
          >
            <option value="">{language === "en" ? "New card - Open Stripe Checkout" : "Tarjeta nueva - Abre Stripe Checkout"}</option>
            {methods.filter((m) => m.provider === "card").length > 0 && <optgroup label={language === "en" ? "Your saved cards (direct charge)" : "Tus tarjetas guardadas (cobro directo)"}></optgroup>}
            {methods
              .filter((m) => m.provider === "card")
              .map((method) => (
                <option key={method.id} value={method.id}>
                  {`${(method.card_brand || "Tarjeta").toUpperCase()} •••• ${method.card_last4 || "0000"}`}
                </option>
              ))}
          </select>

          {recharge.paymentMethodId && methods.find((m) => m.id === recharge.paymentMethodId)?.provider === "card" ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              {language === "en" ? "✓ Will be charged directly without requesting card details." : "✓ Se cobrará directamente sin pedir datos de tarjeta."}
            </div>
          ) : recharge.paymentMethodId ? null : (
            <div className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              {language === "en" ? "Stripe Checkout will open to enter a new card." : "Se abrirá Stripe Checkout para ingresar una tarjeta nueva."}
            </div>
          )}

          <button
            type="submit"
            disabled={isRecharging}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isRecharging
              ? (language === "en" ? "Processing..." : "Procesando...")
              : recharge.paymentMethodId && methods.find((m) => m.id === recharge.paymentMethodId)?.provider === "card"
                ? (language === "en" ? "Charge saved card" : "Cobrar tarjeta guardada")
                : (language === "en" ? "Open Stripe Checkout" : "Abrir Stripe Checkout")}
          </button>
        </form>

        <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{language === "en" ? "Your methods" : "Tus métodos"}</p>
        <h2 className="mt-2 text-2xl font-black text-[#151138]">{language === "en" ? "Current list" : "Listado actual"}</h2>

        <div className="mt-5 space-y-3">
          {methods.map((method) => (
            <div key={method.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-slate-800">{method.provider.toUpperCase()}</p>
                <div className="flex items-center gap-2">
                  {method.is_default ? (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">{language === "en" ? "Default" : "Predeterminado"}</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => startEditMethod(method)}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    {language === "en" ? "Edit" : "Editar"}
                  </button>
                  <button
                    type="button"
                    disabled={deletingMethodId === method.id}
                    onClick={() => void deleteMethod(method.id)}
                    className="rounded-lg border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingMethodId === method.id ? (language === "en" ? "Deleting..." : "Eliminando...") : (language === "en" ? "Delete" : "Eliminar")}
                  </button>
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                {method.provider === "card"
                  ? `${(method.card_brand || "tarjeta").toUpperCase()} •••• ${method.card_last4 || "0000"}`
                  : method.provider === "paypal"
                    ? `PayPal: ${method.paypal_email || "sin correo"}`
                    : method.holder_name || "Método guardado"}
              </p>

              {editingMethodId === method.id ? (
                <div className="mt-3 space-y-2 rounded-xl border border-slate-300 bg-white p-3">
                  <input
                    value={editHolderName}
                    onChange={(event) => setEditHolderName(event.target.value)}
                    placeholder="Titular"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-indigo-300 focus:ring"
                  />
                  {method.provider === "paypal" ? (
                    <input
                      value={editPaypalEmail}
                      onChange={(event) => setEditPaypalEmail(event.target.value)}
                      placeholder="Correo PayPal"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-indigo-300 focus:ring"
                    />
                  ) : null}
                  <label className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={editIsDefault}
                      onChange={(event) => setEditIsDefault(event.target.checked)}
                    />
                    Marcar como predeterminado
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isSavingMethod}
                      onClick={() => void saveEditMethod(method.id)}
                      className="rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSavingMethod ? "Guardando..." : "Guardar"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditMethod}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}

          {methods.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
              No tienes métodos guardados todavía.
            </p>
          ) : null}
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Movimientos wallet</p>
            <button
              type="button"
              onClick={() => void clearRechargeRecords()}
              disabled={isClearingRecharges}
              className="rounded-lg border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isClearingRecharges ? "Limpiando..." : "Limpiar recargas"}
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <p className="font-semibold text-slate-800">
                  {transaction.transaction_type.toUpperCase()} · ${Number(transaction.amount).toFixed(2)}
                </p>
                <p className="text-xs text-slate-500">
                  {transaction.payment_provider ? `Proveedor: ${transaction.payment_provider}` : "Proveedor no especificado"} · Estado: {transaction.status}
                </p>
                <p className="text-xs text-slate-500">{transaction.notes || "Sin notas"}</p>
              </div>
            ))}
            {transactions.length === 0 ? <p className="text-sm text-slate-500">Sin movimientos todavía.</p> : null}
          </div>
        </div>
        </div>
      </article>
    </section>
  );
}
