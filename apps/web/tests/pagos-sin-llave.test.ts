/** Pagos sin NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: mensaje claro en vez de un error de JavaScript. */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("@stripe/stripe-js", () => ({ loadStripe: vi.fn(async () => ({})) }));

describe("llavePublicaDeStripe", () => {
  it("vacía, con espacios o sin definir: null; con valor: la llave sin espacios", async () => {
    const { llavePublicaDeStripe } = await import("@/app/dashboard/cliente/pagos/StripeCardSetupForm");
    expect(llavePublicaDeStripe(undefined)).toBeNull();
    expect(llavePublicaDeStripe("")).toBeNull();
    expect(llavePublicaDeStripe("   ")).toBeNull();
    expect(llavePublicaDeStripe(" pk_test_123 ")).toBe("pk_test_123");
  });

  it("sin llave no se llama a loadStripe y el formulario muestra el aviso", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "");
    const { loadStripe } = await import("@stripe/stripe-js");
    await import("@/app/dashboard/cliente/pagos/StripeCardSetupForm");
    expect(loadStripe).not.toHaveBeenCalled();
    const fuente = readFileSync(path.resolve(import.meta.dirname, "../app/dashboard/cliente/pagos/StripeCardSetupForm.tsx"), "utf8");
    expect(fuente).toContain("if (!stripePromise) {");
    expect(fuente).toContain("Agregar tarjeta no está disponible por ahora.");
    expect(fuente).not.toContain("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!");
    vi.unstubAllEnvs();
  });
});
