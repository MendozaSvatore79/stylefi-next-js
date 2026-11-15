/** Página de Pagos: la clave por intento se reutiliza al reintentar la misma recarga y cambia si cambia. */
import { describe, expect, it } from "vitest";

import { estadoDeMovimiento, intentoDeRecarga } from "@/lib/intento-recarga";

describe("intentoDeRecarga", () => {
  let n = 0;
  const nuevo = () => `id-${++n}`;

  it("la misma recarga (mismo monto y tarjeta) conserva la clave; otro monto u otra tarjeta, clave nueva", () => {
    const a = intentoDeRecarga(null, 150, "tarjeta-1", nuevo);
    expect(intentoDeRecarga(a, 150, "tarjeta-1", nuevo)).toBe(a);
    expect(intentoDeRecarga(a, 150.0, "tarjeta-1", nuevo).id).toBe(a.id);
    expect(intentoDeRecarga(a, 200, "tarjeta-1", nuevo).id).not.toBe(a.id);
    expect(intentoDeRecarga(a, 150, "tarjeta-2", nuevo).id).not.toBe(a.id);
  });

  it("sin intento previo (la recarga anterior terminó): clave nueva", () => {
    expect(intentoDeRecarga(null, 150, "tarjeta-1", nuevo).id).not.toBe(intentoDeRecarga(null, 150, "tarjeta-1", nuevo).id);
  });
});

describe("estadoDeMovimiento", () => {
  it("estados en español; «En proceso» solo para cobros directos ya enviados a Stripe", () => {
    expect(estadoDeMovimiento({ status: "completed" }, "es")).toBe("Completada");
    expect(estadoDeMovimiento({ status: "failed" }, "es")).toBe("No se cobró");
    expect(estadoDeMovimiento({ status: "pending", cobro_directo: true }, "es")).toBe("En proceso");
    expect(estadoDeMovimiento({ status: "pending", cobro_directo: false }, "es")).toBe("Pago sin completar");
    expect(estadoDeMovimiento({ status: "pending", cobro_directo: true }, "en")).toBe("Processing");
  });
});
