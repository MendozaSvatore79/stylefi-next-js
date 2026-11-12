/**
 * Reservar, cancelar, reagendar y estados del negocio (cambio 4.3 y 4.4).
 * Aquí se prueba la lógica de la app con una base simulada. Que la sentencia SQL sea atómica (candado +
 * traslapes + cobro) solo se comprueba contra Postgres real (rama de desarrollo de Neon).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Query } from "./fake-db";

const CLIENTE = "c0000000-0000-0000-0000-000000000001";
const NEGOCIO = "b0000000-0000-0000-0000-000000000001";
const SERVICIO = "e0000000-0000-0000-0000-000000000001";
const GRATIS = "e0000000-0000-0000-0000-000000000002";
const ANA = "a1000000-0000-0000-0000-000000000001";
const BETO = "a1000000-0000-0000-0000-000000000002";
const CITA = "c1000000-0000-0000-0000-000000000001";

type Cte = { cita: Record<string, unknown> | null; ocupado: boolean } | { error: string };

const estado = vi.hoisted(() => ({
  queries: [] as Array<{ text: string; values: unknown[] }>,
  transacciones: [] as Array<Array<{ text: string; values: unknown[] }>>,
  sesion: { user: { id: "c0000000-0000-0000-0000-000000000001", accountType: "cliente" } } as { user: Record<string, unknown> },
  citasDelDia: [] as Array<{ stylist_id: string; scheduled_at: string; ends_at: string }>,
  respuestasCte: [] as Cte[],
  cancelacion: { canceladas: 1, reembolso: "0" },
  citaGuardada: null as null | Record<string, unknown>,
}));

vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => estado.sesion), default: vi.fn() }));
vi.mock("@/lib/db-init", () => ({ ensureStylehubSchema: vi.fn(async () => undefined) }));
vi.mock("@/lib/email", () => ({ sendAppointmentConfirmationEmails: vi.fn(async () => undefined) }));
vi.mock("@/lib/db", () => ({
  getDb: () => {
    const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
      const q = { text: strings.join("$?").replace(/\s+/g, " ").trim(), values };
      estado.queries.push(q);
      return Promise.resolve(responder(q));
    };
    sql.begin = async (fn: (tx: typeof sql) => Promise<unknown[]>[]) => {
      const consultas = fn(sql);
      const desde = estado.queries.length - consultas.length;
      estado.transacciones.push(estado.queries.slice(desde));
      return Promise.all(consultas);
    };
    return sql;
  },
}));

function responder(q: Query): unknown[] {
  const t = q.text;
  if (t.includes("account_type = 'negocio'")) return [{ id: NEGOCIO }];
  if (t.includes("FROM stylehub_business_services")) {
    if (q.values[0] === SERVICIO) return [{ id: SERVICIO, service_name: "Corte", price: "250.00", duration_minutes: 30 }];
    if (q.values[0] === GRATIS) return [{ id: GRATIS, service_name: "Valoración", price: "0.00", duration_minutes: 30 }];
    return [];
  }
  if (t.includes("FROM stylehub_business_stylists")) {
    const pedido = q.values.at(-1) as string | null;
    return [ANA, BETO].filter((id) => !pedido || id === pedido).map((id) => ({ id }));
  }
  if (t.includes("FROM stylehub_stylist_schedule_blocks")) {
    return [0, 1, 2, 3, 4, 5, 6].flatMap((dia) => [ANA, BETO].map((id) => ({ stylist_id: id, day_of_week: dia, start_time: "10:00:00", end_time: "14:00:00" })));
  }
  if (t.startsWith("SELECT stylist_id, scheduled_at, ends_at FROM stylehub_client_appointments")) return estado.citasDelDia;
  if (t.includes("FROM stylehub_stylist_absences") && t.startsWith("SELECT stylist_id")) return [];
  if (t.startsWith("SELECT pg_advisory_xact_lock")) return [{}];
  if (t.startsWith("WITH conflicto AS")) {
    const r = estado.respuestasCte.shift() ?? { cita: { id: "nueva" }, ocupado: false };
    if ("error" in r) return Promise.reject(Object.assign(new Error("exclusion"), { code: r.error })) as never;
    return [r];
  }
  if (t.startsWith("WITH cancelada AS")) return [estado.cancelacion];
  if (t.startsWith("SELECT status, scheduled_at FROM stylehub_client_appointments")) return estado.citaGuardada ? [estado.citaGuardada] : [];
  if (t.startsWith("SELECT id, client_user_id, business_user_id")) return estado.citaGuardada ? [estado.citaGuardada] : [];
  if (t.startsWith("UPDATE stylehub_client_appointments SET scheduled_at")) return [{ id: CITA }];
  if (t.includes("FROM stylehub_client_appointments a JOIN stylehub_users c")) return estado.citaGuardada ? [estado.citaGuardada] : [];
  if (t.startsWith("UPDATE stylehub_client_appointments SET status")) return [{ id: CITA }];
  return [];
}

// Fechas: "ahora" fijo para la lógica; la API usa la hora real y pide pasado mañana
const AHORA = new Date("2030-01-06T18:00:00Z"); // domingo, mediodía en México
const LUNES_10 = new Date("2030-01-07T16:00:00Z"); // lunes 10:00 en México
const PASADO_MANANA = new Date(Date.now() + 2 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });

const db = async () => (await import("@/lib/db")).getDb() as never;
const ultimaTx = () => estado.transacciones.at(-1)!;
const candadoDe = (tx: Query[]) => tx[0].values[0];

beforeEach(() => {
  estado.queries = [];
  estado.transacciones = [];
  estado.citasDelDia = [];
  estado.respuestasCte = [];
  estado.cancelacion = { canceladas: 1, reembolso: "0" };
  estado.citaGuardada = null;
  estado.sesion = { user: { id: CLIENTE, accountType: "cliente" } };
});

const base = { clienteId: CLIENTE, businessUserId: NEGOCIO, branchId: null, serviceId: SERVICIO, stylistId: null, inicio: LUNES_10, pago: "cash" as const, notas: null, ahora: AHORA };

describe("reservar", () => {
  it("solo acepta horarios que el motor ofrece; si no, no abre ninguna transacción", async () => {
    const { reservar, HorarioNoDisponible } = await import("@/lib/booking");
    await expect(reservar(await db(), { ...base, inicio: new Date("2030-01-07T16:05:00Z") })).rejects.toBeInstanceOf(HorarioNoDisponible);
    await expect(reservar(await db(), { ...base, inicio: new Date("2030-01-07T15:00:00Z") })).rejects.toBeInstanceOf(HorarioNoDisponible); // 9:00
    expect(estado.transacciones).toEqual([]);
  });

  it("toma el candado del estilista y crea la cita en la misma transacción, con las protecciones en el SQL", async () => {
    const { reservar } = await import("@/lib/booking");
    await reservar(await db(), { ...base, stylistId: ANA });
    const [lock, cte] = ultimaTx();
    expect(lock.text).toContain("pg_advisory_xact_lock");
    expect(candadoDe(ultimaTx())).toBe(ANA);
    expect(cte.text).toContain("WHERE NOT EXISTS (SELECT 1 FROM conflicto)");
    expect(cte.text).toContain("balance >= $?::numeric");
    expect(cte.text).toContain("OR EXISTS (SELECT 1 FROM debito)");
    expect(cte.text).toContain("FROM stylehub_stylist_absences");
  });

  it("guarda el precio del servicio y la hora de fin; un servicio de $0 queda sin cobro", async () => {
    const { reservar } = await import("@/lib/booking");
    await reservar(await db(), { ...base, pago: "wallet" });
    let cte = ultimaTx()[1];
    expect(cte.values).toContain(250);
    expect(cte.values).toContain("2030-01-07T16:30:00.000Z"); // fin = inicio + 30 min
    expect(cte.values).toContain("wallet");
    await reservar(await db(), { ...base, serviceId: GRATIS, pago: "wallet" });
    cte = ultimaTx()[1];
    expect(cte.values).toContain("free");
    expect(cte.values).not.toContain("wallet");
  });

  it("con «cualquiera» intenta primero al estilista con menos citas ese día", async () => {
    estado.citasDelDia = [{ stylist_id: ANA, scheduled_at: "2030-01-07T19:00:00Z", ends_at: "2030-01-07T19:30:00Z" }];
    const { reservar } = await import("@/lib/booking");
    await reservar(await db(), base);
    expect(candadoDe(ultimaTx())).toBe(BETO);
  });

  it("si la base rechaza el traslape (otra reserva ganó), intenta con el siguiente estilista libre", async () => {
    estado.respuestasCte = [{ error: "23P01" }, { cita: { id: "nueva" }, ocupado: false }];
    const { reservar } = await import("@/lib/booking");
    const cita = await reservar(await db(), base);
    expect(cita).toEqual({ id: "nueva" });
    expect(estado.transacciones.map(candadoDe)).toEqual([ANA, BETO]);
  });

  it("si todos quedaron ocupados en el último momento, HorarioNoDisponible", async () => {
    estado.respuestasCte = [{ cita: null, ocupado: true }, { cita: null, ocupado: true }];
    const { reservar, HorarioNoDisponible } = await import("@/lib/booking");
    await expect(reservar(await db(), base)).rejects.toBeInstanceOf(HorarioNoDisponible);
  });

  it("sin cita y sin traslape significa saldo insuficiente (y no se intenta con otro estilista)", async () => {
    estado.respuestasCte = [{ cita: null, ocupado: false }];
    const { reservar, SaldoInsuficiente } = await import("@/lib/booking");
    await expect(reservar(await db(), { ...base, pago: "wallet" })).rejects.toBeInstanceOf(SaldoInsuficiente);
    expect(estado.transacciones).toHaveLength(1);
  });
});

describe("POST /api/client/appointments", () => {
  async function agendar(cuerpo: Record<string, unknown>) {
    const { POST } = await import("@/app/api/client/appointments/route");
    return (await POST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify(cuerpo) }))) as Response;
  }
  const horaReal = (hora: string) => new Date(`${PASADO_MANANA}T${hora}:00-06:00`).toISOString();

  it("crea la cita confirmada (201)", async () => {
    const r = await agendar({ businessUserId: NEGOCIO, serviceId: SERVICIO, scheduledAt: horaReal("10:00") });
    expect(r.status).toBe(201);
    expect(ultimaTx()[1].text).toContain("'confirmed'");
  });

  it.each([
    [{ businessUserId: NEGOCIO, serviceId: SERVICIO, scheduledAt: "x", paymentProvider: "card" }, 400],
    [{ businessUserId: NEGOCIO, serviceId: SERVICIO, scheduledAt: "2030-01-07T16:00:00Z", paymentProvider: "card" }, 400],
    [{ businessUserId: NEGOCIO, scheduledAt: "2030-01-07T16:00:00Z" }, 400],
    [{ businessUserId: NEGOCIO, serviceId: SERVICIO, stylistId: "no-uuid", scheduledAt: "2030-01-07T16:00:00Z" }, 400],
  ])("rechaza %j con %i (tarjeta ya no disponible, sin servicio, ids mal formados)", async (cuerpo, codigo) => {
    expect((await agendar(cuerpo)).status).toBe(codigo);
    expect(estado.transacciones).toEqual([]);
  });

  it("un horario ocupado responde 409 y saldo insuficiente 400", async () => {
    estado.respuestasCte = [{ cita: null, ocupado: true }, { cita: null, ocupado: true }];
    expect((await agendar({ businessUserId: NEGOCIO, serviceId: SERVICIO, scheduledAt: horaReal("10:00") })).status).toBe(409);
    estado.respuestasCte = [{ cita: null, ocupado: false }];
    expect((await agendar({ businessUserId: NEGOCIO, serviceId: SERVICIO, scheduledAt: horaReal("10:00"), paymentProvider: "wallet" })).status).toBe(400);
  });
});

describe("cancelar", () => {
  it("el cliente cancela hasta 2 horas antes y recibe el reembolso del monedero en la misma sentencia", async () => {
    estado.cancelacion = { canceladas: 1, reembolso: "250.00" };
    const { cancelarCita } = await import("@/lib/booking");
    expect(await cancelarCita(await db(), { appointmentId: CITA, por: "cliente", userId: CLIENTE, ahora: AHORA })).toEqual({ reembolso: 250 });
    const q = estado.queries.find((x) => x.text.startsWith("WITH cancelada AS"))!;
    expect(q.values).toContain("2030-01-06T20:00:00.000Z"); // ahora + 2 h
    expect(q.text).toContain("'refund'");
    expect(q.text).toContain("c.payment_provider = 'wallet'");
  });

  it("el negocio cancela en cualquier momento (sin plazo) y también reembolsa", async () => {
    const { cancelarCita } = await import("@/lib/booking");
    await cancelarCita(await db(), { appointmentId: CITA, por: "negocio", userId: NEGOCIO, ahora: AHORA });
    expect(estado.queries.find((x) => x.text.startsWith("WITH cancelada AS"))!.values).toContain("1970-01-01T00:00:00.000Z");
  });

  it.each([
    [null, "No encontramos"],
    [{ status: "completed", scheduled_at: "2030-01-07T16:00:00Z" }, "pendientes o confirmadas"],
    [{ status: "confirmed", scheduled_at: "2030-01-06T19:00:00Z" }, "2 horas antes"],
  ])("si no se pudo cancelar explica el motivo (%j)", async (cita, mensaje) => {
    estado.cancelacion = { canceladas: 0, reembolso: "0" };
    estado.citaGuardada = cita;
    const { cancelarCita } = await import("@/lib/booking");
    await expect(cancelarCita(await db(), { appointmentId: CITA, por: "cliente", userId: CLIENTE, ahora: AHORA })).rejects.toThrow(mensaje);
  });
});

describe("reagendar", () => {
  const citaActual = (extra: Record<string, unknown> = {}) => ({
    id: CITA, client_user_id: CLIENTE, business_user_id: NEGOCIO, branch_id: null, service_id: SERVICIO,
    stylist_id: BETO, status: "confirmed", scheduled_at: "2030-01-08T16:00:00Z", ...extra,
  });

  it("no se puede a menos de 2 horas de la cita actual", async () => {
    estado.citaGuardada = citaActual({ scheduled_at: "2030-01-06T19:30:00Z" });
    const { reagendarCita } = await import("@/lib/booking");
    await expect(reagendarCita(await db(), { appointmentId: CITA, clienteId: CLIENTE, nuevoInicio: LUNES_10, stylistId: null, ahora: AHORA })).rejects.toThrow("2 horas antes");
  });

  it("la propia cita no cuenta como ocupada y se conserva al estilista si está libre", async () => {
    estado.citaGuardada = citaActual();
    estado.citasDelDia = [{ stylist_id: ANA, scheduled_at: "2030-01-07T19:00:00Z", ends_at: "2030-01-07T19:30:00Z" }];
    const { reagendarCita } = await import("@/lib/booking");
    await reagendarCita(await db(), { appointmentId: CITA, clienteId: CLIENTE, nuevoInicio: LUNES_10, stylistId: null, ahora: AHORA });
    const agenda = estado.queries.find((x) => x.text.startsWith("SELECT stylist_id, scheduled_at, ends_at FROM stylehub_client_appointments"))!;
    expect(agenda.values).toContain(CITA);
    expect(candadoDe(ultimaTx())).toBe(BETO);
    expect(ultimaTx()[1].text).toContain("o.id <> $?::uuid");
  });

  it("solo a horarios ofrecidos", async () => {
    estado.citaGuardada = citaActual();
    const { reagendarCita, HorarioNoDisponible } = await import("@/lib/booking");
    await expect(
      reagendarCita(await db(), { appointmentId: CITA, clienteId: CLIENTE, nuevoInicio: new Date("2030-01-07T22:00:00Z"), stylistId: null, ahora: AHORA }),
    ).rejects.toBeInstanceOf(HorarioNoDisponible); // 16:00, fuera del horario
  });
});

describe("estados que pone el negocio", () => {
  beforeEach(() => {
    estado.sesion = { user: { id: NEGOCIO, accountType: "negocio" } };
  });
  async function cambiar(status: string, cita: Record<string, unknown> | null) {
    estado.citaGuardada = cita && { id: CITA, service_name: "Corte", total_amount: "250", client_email: "c@test", business_email: "b@test", ...cita };
    const { PATCH } = await import("@/app/api/business/appointments/route");
    return (await PATCH(new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify({ appointmentId: CITA, status }) }))) as Response;
  }
  const pasada = new Date(Date.now() - 3_600_000).toISOString();
  const futura = new Date(Date.now() + 86_400_000).toISOString();

  it("cancelar usa la cancelación con reembolso del 100 %", async () => {
    estado.cancelacion = { canceladas: 1, reembolso: "250.00" };
    const r = await cambiar("cancelled", { status: "confirmed", scheduled_at: futura });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ refund: 250 });
  });

  it.each([
    ["completed", { status: "confirmed", scheduled_at: futura }, 400],
    ["no_show", { status: "confirmed", scheduled_at: futura }, 400],
    ["completed", { status: "confirmed", scheduled_at: pasada }, 200],
    ["no_show", { status: "pending", scheduled_at: pasada }, 200],
    ["confirmed", { status: "pending", scheduled_at: futura }, 200],
    ["confirmed", { status: "confirmed", scheduled_at: futura }, 400],
    ["confirmed", { status: "cancelled", scheduled_at: futura }, 400],
    ["completed", { status: "no_show", scheduled_at: pasada }, 400],
    ["pending", { status: "confirmed", scheduled_at: futura }, 400],
  ])("%s desde %j responde %i", async (status, cita, codigo) => {
    expect((await cambiar(status, cita)).status).toBe(codigo);
  });
});
