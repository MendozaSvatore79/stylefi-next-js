/** Carga de disponibilidad desde la base y API /api/client/appointments/availability. */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Query } from "./fake-db";

const NEGOCIO = "b0000000-0000-0000-0000-000000000001";
const SERVICIO = "e0000000-0000-0000-0000-000000000001";
const ANA = "a1000000-0000-0000-0000-000000000001";
const BETO = "a1000000-0000-0000-0000-000000000002";

const estado = vi.hoisted(() => ({ queries: [] as Array<{ text: string; values: unknown[] }>, estilistas: [] as string[] }));

vi.mock("@/lib/sesion", () => ({
  obtenerSesion: vi.fn(async () => ({ user: { id: "c0000000-0000-0000-0000-000000000001", accountType: "cliente" } })),
}));
vi.mock("@/lib/db-init", () => ({ ensureStylehubSchema: vi.fn(async () => undefined) }));
vi.mock("@/lib/db", () => ({
  getDb: () => (strings: TemplateStringsArray, ...values: unknown[]) => {
    const q = { text: strings.join("$?").replace(/\s+/g, " ").trim(), values };
    estado.queries.push(q);
    return Promise.resolve(responder(q));
  },
}));

function responder(q: Query): unknown[] {
  const t = q.text;
  if (t.includes("FROM stylehub_business_services")) {
    return q.values[0] === SERVICIO && q.values[1] === NEGOCIO ? [{ id: SERVICIO, service_name: "Corte", price: "200.00", duration_minutes: null }] : [];
  }
  if (t.includes("FROM stylehub_business_stylists")) {
    const pedido = q.values.at(-1) as string | null;
    return estado.estilistas.filter((id) => !pedido || id === pedido).map((id) => ({ id }));
  }
  if (t.includes("FROM stylehub_stylist_schedule_blocks")) {
    // Todos los días, para que las pruebas de la API (que usan la fecha real) también tengan horario
    return [0, 1, 2, 3, 4, 5, 6].flatMap((dia) => [
      { stylist_id: ANA, day_of_week: dia, start_time: "10:00:00", end_time: "12:00:00" },
      { stylist_id: BETO, day_of_week: dia, start_time: "11:00:00", end_time: "13:00:00" },
    ]);
  }
  if (t.includes("FROM stylehub_client_appointments")) {
    return [{ stylist_id: ANA, scheduled_at: new Date("2030-01-07T16:30:00Z"), ends_at: "2030-01-07T17:00:00Z" }]; // 10:30–11:00
  }
  if (t.includes("FROM stylehub_stylist_absences")) return [];
  return [];
}

beforeEach(() => {
  estado.queries = [];
  estado.estilistas = [ANA, BETO];
});

async function pedir(params: Record<string, string>) {
  const { GET } = await import("@/app/api/client/appointments/availability/route");
  return (await GET(new Request(`http://localhost/x?${new URLSearchParams(params)}`))) as Response;
}

describe("disponibilidad", () => {
  const ahora = new Date("2030-01-06T18:00:00Z");

  it("junta los estilistas que hacen el servicio, con 30 min si el servicio no tiene duración", async () => {
    const { disponibilidad } = await import("@/lib/booking");
    const { horaLocal } = await import("@stylefi/shared");
    const db = (await import("@/lib/db")).getDb() as never;
    const r = await disponibilidad(db, { businessUserId: NEGOCIO, branchId: null, serviceId: SERVICIO, stylistId: null, fecha: "2030-01-07", ahora });
    expect(r.servicio.duration_minutes).toBe(30);
    const por = Object.fromEntries(r.horarios.map((x) => [horaLocal(x.inicio), x.estilistas]));
    expect(por["10:00"]).toEqual([ANA]);
    expect(por["10:30"]).toBeUndefined(); // Ana tiene cita y Beto aún no entra
    expect(por["11:00"].sort()).toEqual([ANA, BETO].sort());
    expect(por["12:30"]).toEqual([BETO]);
  });

  it("solo busca estilistas disponibles que hacen el servicio, en la sucursal si se eligió", async () => {
    const { estilistasCandidatos } = await import("@/lib/booking");
    const db = (await import("@/lib/db")).getDb() as never;
    await estilistasCandidatos(db, { businessUserId: NEGOCIO, branchId: null, serviceId: SERVICIO, stylistId: null });
    const q = estado.queries.find((x) => x.text.includes("FROM stylehub_business_stylists"))!;
    expect(q.text).toContain("JOIN stylehub_stylist_services");
    expect(q.text).toContain("s.available = TRUE");
    expect(q.text).toContain("s.branch_id =");
  });

  it("las citas canceladas no ocupan horario", async () => {
    const { agendaDelDia } = await import("@/lib/booking");
    const db = (await import("@/lib/db")).getDb() as never;
    await agendaDelDia(db, [ANA], "2030-01-07");
    expect(estado.queries.find((x) => x.text.includes("FROM stylehub_client_appointments"))!.text).toContain("status <> 'cancelled'");
  });
});

describe("GET /api/client/appointments/availability", () => {
  // La API usa la hora real: se pide pasado mañana, dentro de los 30 días
  const PASADO_MANANA = new Date(Date.now() + 2 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });

  it("responde con el formato del selector de horarios y los estilistas libres", async () => {
    const r = await pedir({ businessUserId: NEGOCIO, serviceId: SERVICIO, date: PASADO_MANANA });
    expect(r.status).toBe(200);
    const datos = await r.json();
    expect(datos.serviceDuration).toBe(30);
    expect(datos.slots.length).toBeGreaterThan(0);
    expect(datos.slots[0].time).toBe("10:00");
    expect(datos.slots.every((s: { isAvailable: boolean }) => s.isAvailable)).toBe(true);
    for (const s of datos.slots) expect(s).toMatchObject({ time: expect.stringMatching(/^\d\d:\d\d$/), iso: expect.any(String), stylistIds: expect.any(Array) });
  });

  it("con un estilista elegido solo muestra sus horarios", async () => {
    const r = await pedir({ businessUserId: NEGOCIO, serviceId: SERVICIO, date: PASADO_MANANA, stylistId: BETO });
    const datos = await r.json();
    expect(datos.slots.length).toBeGreaterThan(0);
    expect(datos.slots[0].time).toBe("11:00");
    expect(datos.slots.every((s: { stylistIds: string[] }) => s.stylistIds.join() === BETO)).toBe(true);
  });

  it.each([
    [{ businessUserId: NEGOCIO, serviceId: SERVICIO }, 400],
    [{ businessUserId: NEGOCIO, serviceId: "x", date: "2030-01-07" }, 400],
    [{ businessUserId: NEGOCIO, serviceId: SERVICIO, date: "2030-02-30" }, 400],
    [{ businessUserId: NEGOCIO, serviceId: "e0000000-0000-0000-0000-00000000000f", date: "2030-01-07" }, 404],
  ])("%j responde %i", async (params, codigo) => {
    expect((await pedir(params as Record<string, string>)).status).toBe(codigo);
  });
});
