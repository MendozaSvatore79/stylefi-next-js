import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Decisión de producto (2026-11-25): mientras los pagos en línea estén apagados, las citas se pagan solo en el salón.
 * El salón no recibe lo que se cobra del monedero y, sin Stripe, nadie puede recargar. El backend también rechaza el
 * saldo; aquí se revisa que las dos pantallas que agendan no lo ofrezcan ni lo manden.
 */
const PANTALLAS = {
  "modal del salón": "components/salon-modal.tsx",
  "Mis citas del cliente": "app/(con-sesion)/dashboard/cliente/citas/page.tsx",
};

const leer = (ruta: string) => readFileSync(new URL(`../${ruta}`, import.meta.url), "utf8");

describe.each(Object.entries(PANTALLAS))("%s", (_nombre, ruta) => {
  const fuente = leer(ruta);

  it("lee pagosEnLinea del backend y empieza sin ofrecer el saldo", () => {
    expect(fuente).toContain("setPagosEnLinea(pagosEnLineaDe(");
    expect(fuente).toMatch(/const \[pagosEnLinea, setPagosEnLinea\] = useState\(false\)/);
  });

  it("manda efectivo si los pagos están apagados, aunque el formulario diga saldo", () => {
    expect(fuente).toMatch(/const pago = pagosEnLinea \? \w+\.paymentProvider : "cash";/);
    expect(fuente).toContain("paymentProvider: pago,");
    expect(fuente).not.toMatch(/paymentProvider: (form|bookingForm)\.paymentProvider/);
  });

  it("el botón de saldo solo existe dentro de la rama con pagos en línea", () => {
    const inicio = fuente.indexOf("{pagosEnLinea ? (");
    expect(inicio).toBeGreaterThan(-1);
    const sinPagos = fuente.indexOf(") : (", inicio);
    const botonSaldo = fuente.indexOf('paymentProvider: "wallet" }))');
    expect(botonSaldo).toBeGreaterThan(inicio);
    expect(botonSaldo).toBeLessThan(sinPagos);
  });
});
