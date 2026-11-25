import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { esReservable } from "@/lib/salon-reservable";

const leer = (archivo: string) => readFileSync(path.resolve(import.meta.dirname, "..", archivo), "utf8");
const salones = leer("app/(con-sesion)/dashboard/cliente/salones/page.tsx");
const modal = leer("components/salon-modal.tsx");
const citas = leer("app/(con-sesion)/dashboard/cliente/citas/page.tsx");

describe("salón sin horarios (reservable del catálogo)", () => {
  it("solo reservable: false lo marca como no reservable (sin el campo, como antes)", () => {
    expect(esReservable({ reservable: false })).toBe(false);
    expect(esReservable({ reservable: true })).toBe(true);
    expect(esReservable({})).toBe(true);
    expect(esReservable(undefined)).toBe(true);
  });

  it("Salones: la tarjeta muestra «Aún sin horarios» y el modal recibe si se puede reservar", () => {
    expect(salones).toMatch(/\{!esReservable\(business\) \? \([\s\S]{0,300}t\("salons\.noSchedule"\)/);
    expect(salones).toContain("reservable={esReservable(businesses.find((b) => b.id === selectedBusiness))}");
  });

  it("el modal no ofrece «Agendar cita» si no se puede reservar, y explica por qué", () => {
    expect(modal).toMatch(/\{reservable \? \(\s*<button\s+onClick=\{handleAgendar\}/);
    expect(modal).toContain('t("salons.noScheduleDesc")');
  });

  it("Mis citas solo ofrece salones que se pueden reservar", () => {
    expect(citas).toContain("{businesses.filter(esReservable).map((business) => (");
  });
});
