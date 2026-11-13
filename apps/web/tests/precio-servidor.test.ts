/** Al agendar, el precio y el nombre del servicio los fija el servidor; lo que mande el navegador se ignora. */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Query } from "./fake-db";

const NEGOCIO = "b0000000-0000-0000-0000-000000000001";
const SUCURSAL = "d0000000-0000-0000-0000-000000000001";
const SERVICIO = "e0000000-0000-0000-0000-000000000001"; // $250, de la sucursal
const GRATIS = "e0000000-0000-0000-0000-000000000002"; // $0, sin sucursal
const AJENO = "e0000000-0000-0000-0000-000000000003"; // de otro negocio
const ANA = "a1000000-0000-0000-0000-000000000001";

const SERVICIOS: Record<string, { negocio: string; sucursal: string | null; nombre: string; precio: string }> = {
  [SERVICIO]: { negocio: NEGOCIO, sucursal: SUCURSAL, nombre: "Corte clásico", precio: "250.00" },
  [GRATIS]: { negocio: NEGOCIO, sucursal: null, nombre: "Valoración", precio: "0.00" },
  [AJENO]: { negocio: "b0000000-0000-0000-0000-00000000000f", sucursal: null, nombre: "Ajeno", precio: "10.00" },
};

const estado = vi.hoisted(() => ({ saldo: 1000, queries: [] as Array<{ text: string; values: unknown[] }> }));

vi.mock("@/lib/sesion", () => ({
  obtenerSesion: vi.fn(async () => ({ user: { id: "c0000000-0000-0000-0000-000000000001", accountType: "cliente" } })),
}));
vi.mock("@/lib/db-init", () => ({ ensureStylehubSchema: vi.fn(async () => undefined) }));
vi.mock("@/lib/db", () => ({
  getDb: () => {
    const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
      const q = { text: strings.join("$?").replace(/\s+/g, " ").trim(), values };
      estado.queries.push(q);
      return Promise.resolve(responder(q));
    };
    sql.begin = (fn: (tx: typeof sql) => Promise<unknown[]>[]) => Promise.all(fn(sql));
    return sql;
  },
}));

function responder(q: Query): unknown[] {
  const t = q.text;
  if (t.includes("FROM stylehub_users") && t.includes("account_type = 'negocio'")) return q.values[0] === NEGOCIO ? [{ id: NEGOCIO }] : [];
  if (t.includes("FROM stylehub_business_branches")) return q.values[0] === SUCURSAL && q.values[1] === NEGOCIO ? [{ id: SUCURSAL }] : [];
  if (t.includes("FROM stylehub_business_services")) {
    const [id, negocio, sucursal] = q.values as string[];
    const s = SERVICIOS[id];
    const conSucursal = t.includes("branch_id = $?");
    if (!s || s.negocio !== negocio || (conSucursal && s.sucursal !== sucursal)) return [];
    return [{ id, service_name: s.nombre, price: s.precio, duration_minutes: 30 }];
  }
  if (t.includes("FROM stylehub_business_stylists")) return [{ id: ANA }];
  if (t.includes("FROM stylehub_stylist_schedule_blocks")) {
    return [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ stylist_id: ANA, day_of_week: dia, start_time: "10:00:00", end_time: "14:00:00" }));
  }
  if (t.startsWith("WITH conflicto AS")) {
    // Simula la sentencia: si paga con monedero, cobra el monto que recibe la sentencia (el del servidor)
    const monto = Number(q.values.find((v) => typeof v === "number"));
    const usaMonedero = q.values.includes(true);
    if (usaMonedero && estado.saldo < monto) return [{ cita: null, ocupado: false }];
    if (usaMonedero) estado.saldo -= monto;
    return [{ cita: { id: "cita1" }, ocupado: false }];
  }
  return [];
}

const PASADO_MANANA_10 = new Date(
  `${new Date(Date.now() + 2 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" })}T10:00:00-06:00`,
).toISOString();

async function agendar(cuerpo: Record<string, unknown>) {
  const { POST } = await import("@/app/api/client/appointments/route");
  // El handler está tipado como Response | undefined; en estas rutas siempre responde
  return (await POST(
    new Request("http://localhost/api/client/appointments", {
      method: "POST",
      body: JSON.stringify({ businessUserId: NEGOCIO, scheduledAt: PASADO_MANANA_10, ...cuerpo }),
    }),
  )) as Response;
}

const sentencia = () => estado.queries.find((q) => q.text.startsWith("WITH conflicto AS"));

beforeEach(() => {
  estado.saldo = 1000;
  estado.queries = [];
});

describe("POST /api/client/appointments: el servidor fija el precio", () => {
  it("ignora un precio y un nombre alterados y guarda los del servicio", async () => {
    const r = await agendar({ serviceId: SERVICIO, branchId: SUCURSAL, totalAmount: 1, serviceName: "Lo que yo quiera" });
    expect(r.status).toBe(201);
    expect(sentencia()!.values).toContain("Corte clásico");
    expect(sentencia()!.values).toContain(250);
    expect(sentencia()!.values).not.toContain("Lo que yo quiera");
    expect(sentencia()!.values).not.toContain(1);
  });

  it("el monedero cobra el precio real, no el que manda el navegador", async () => {
    const r = await agendar({ serviceId: SERVICIO, branchId: SUCURSAL, totalAmount: 1, paymentProvider: "wallet" });
    expect(r.status).toBe(201);
    expect(estado.saldo).toBe(750);
  });

  it("con saldo insuficiente para el precio real responde 400 y no se cobra", async () => {
    estado.saldo = 100;
    const r = await agendar({ serviceId: SERVICIO, branchId: SUCURSAL, totalAmount: 50, paymentProvider: "wallet" });
    expect(r.status).toBe(400);
    expect(estado.saldo).toBe(100);
  });

  it("un servicio de $0 se reserva sin cobro aunque se elija monedero", async () => {
    const r = await agendar({ serviceId: GRATIS, paymentProvider: "wallet" });
    expect(r.status).toBe(201);
    expect(sentencia()!.values).toContain("free");
    expect(estado.saldo).toBe(1000);
  });

  it.each([
    ["sin servicio", {}],
    ["servicio de otro negocio", { serviceId: AJENO }],
    ["servicio que no es de la sucursal elegida", { serviceId: GRATIS, branchId: SUCURSAL }],
    ["identificador de servicio mal formado", { serviceId: "1 OR 1=1" }],
    ["identificador de sucursal mal formado", { serviceId: SERVICIO, branchId: "x" }],
    ["la opción tarjeta (ya no disponible)", { serviceId: SERVICIO, branchId: SUCURSAL, paymentProvider: "card" }],
  ])("%s: responde 400 y no crea la cita", async (_caso, cuerpo) => {
    const r = await agendar(cuerpo);
    expect(r.status).toBe(400);
    expect(sentencia()).toBeUndefined();
  });

  it("el identificador mal formado no llega a la base", async () => {
    await agendar({ serviceId: "1 OR 1=1" });
    expect(estado.queries.some((q) => q.text.includes("stylehub_business_services"))).toBe(false);
  });
});
