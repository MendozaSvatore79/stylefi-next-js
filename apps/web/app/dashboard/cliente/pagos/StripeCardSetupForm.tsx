"use client";
import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

function CardSetupForm({ onSuccess }: { onSuccess?: () => void | Promise<void> }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [holderName, setHolderName] = useState("");
  const [isDefault, setIsDefault] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!stripe || !elements) {
      setError("Stripe aún no está listo. Inténtalo de nuevo.");
      setLoading(false);
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setError("No se pudo inicializar el formulario de tarjeta.");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/client/payment-methods/setup-intent", { method: "POST" });
    const setupPayload = (await res.json()) as { clientSecret?: string; error?: string };

    if (!res.ok || !setupPayload.clientSecret) {
      setError(setupPayload.error ?? "No se pudo iniciar la configuración segura de tarjeta.");
      setLoading(false);
      return;
    }

    const result = await stripe.confirmCardSetup(setupPayload.clientSecret, {
      payment_method: {
        card: cardElement,
        billing_details: {
          name: holderName.trim() || undefined,
        },
      },
    });

    if (result.error || !result.setupIntent?.payment_method) {
      setError(result.error?.message || "Error al guardar la tarjeta");
      setLoading(false);
      return;
    }

    const saveRes = await fetch("/api/client/payment-methods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentMethodId: result.setupIntent.payment_method,
        isDefault,
      }),
    });

    const savePayload = (await saveRes.json()) as { error?: string };

    if (!saveRes.ok) {
      setError(savePayload.error ?? "No se pudo guardar la tarjeta en tu cuenta.");
      setLoading(false);
      return;
    }

    setHolderName("");
    setIsDefault(true);
    setLoading(false);
    if (onSuccess) {
      await onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        value={holderName}
        onChange={(event) => setHolderName(event.target.value)}
        placeholder="Titular (opcional)"
        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ring-indigo-300 focus:ring"
      />
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
        <CardElement
          options={{
            hidePostalCode: true,
            style: {
              base: {
                fontSize: "14px",
                color: "#0f172a",
              },
            },
          }}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} />
        Marcar como método predeterminado
      </label>
      {error ? <div className="text-xs font-semibold text-red-600">{error}</div> : null}
      <button
        type="submit"
        disabled={!stripe || loading}
        className="inline-flex h-11 items-center justify-center rounded-xl bg-[#130b3a] px-5 text-sm font-semibold text-white transition hover:bg-[#231365] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? "Guardando..." : "Guardar tarjeta segura"}
      </button>
    </form>
  );
}

export default function StripeCardSetupForm(props: { onSuccess?: () => void | Promise<void> }) {
  return (
    <Elements stripe={stripePromise}>
      <CardSetupForm {...props} />
    </Elements>
  );
}
