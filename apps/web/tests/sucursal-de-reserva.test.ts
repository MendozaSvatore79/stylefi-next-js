import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { estilistasParaElServicio, lugarDeLaCita, sucursalDelServicio, sucursalVisible } from "@/lib/sucursal-de-reserva";

const citas = readFileSync(path.resolve(import.meta.dirname, "..", "app/(con-sesion)/dashboard/cliente/citas/page.tsx"), "utf8");

const servicios = [
  { id: "corte", branch_id: "centro" },
  { id: "tinte", branch_id: "norte" },
  { id: "viejo", branch_id: null },
];

describe("sucursal de la reserva en «Mis citas»", () => {
  it("la sucursal es la del servicio elegido; sin servicio o sin sucursal, null", () => {
    expect(sucursalDelServicio(servicios, "tinte")).toBe("norte");
    expect(sucursalDelServicio(servicios, "corte")).toBe("centro");
    expect(sucursalDelServicio(servicios, "")).toBeNull();
    expect(sucursalDelServicio(servicios, "viejo")).toBeNull();
  });

  it("solo ofrece estilistas disponibles, que hacen el servicio y de su sucursal", () => {
    const estilistas = [
      { id: "ana", branch_id: "centro", service_ids: ["corte"] },
      { id: "nora", branch_id: "norte", service_ids: ["corte", "tinte"] },
      { id: "beto", branch_id: "centro", service_ids: ["corte"], available: false },
      { id: "sin-sucursal", branch_id: null, service_ids: ["corte"] },
    ];
    expect(estilistasParaElServicio(estilistas, "corte", "centro").map((e) => e.id)).toEqual(["ana", "sin-sucursal"]);
    expect(estilistasParaElServicio(estilistas, "tinte", "norte").map((e) => e.id)).toEqual(["nora"]);
    // Servicio viejo sin sucursal: no se filtra por sucursal
    expect(estilistasParaElServicio(estilistas, "corte", null).map((e) => e.id)).toEqual(["ana", "nora", "sin-sucursal"]);
  });

  it("muestra la sucursal junto al servicio solo si el negocio tiene más de una", () => {
    const dos = [
      { id: "centro", branch_name: "Centro" },
      { id: "norte", branch_name: "Norte" },
    ];
    expect(sucursalVisible(dos, "norte")).toBe("Norte");
    expect(sucursalVisible([dos[0]], "centro")).toBeNull();
    expect(sucursalVisible(dos, null)).toBeNull();
  });

  it("el lugar de la cita: sucursal y ciudad, o nada", () => {
    expect(lugarDeLaCita({ branch_name: "Norte", branch_city: "Monterrey" })).toBe("Norte · Monterrey");
    expect(lugarDeLaCita({ branch_name: "Norte", branch_city: null })).toBe("Norte");
    expect(lugarDeLaCita({ branch_name: null, branch_city: null })).toBeNull();
  });

  it("la pantalla manda la sucursal al reservar, filtra estilistas por ella y muestra el lugar de cada cita", () => {
    expect(citas).toMatch(/serviceId: form\.serviceId,[\s\S]{0,200}branchId: sucursalDelServicio\(services, form\.serviceId\),/);
    expect(citas).toContain("estilistasParaElServicio(stylists, form.serviceId, sucursalDelServicio(services, form.serviceId))");
    expect(citas).toContain("{lugarDeLaCita(appointment) ? (");
    expect(citas).toContain("setBranches(payload.branches ?? []);");
  });
});
