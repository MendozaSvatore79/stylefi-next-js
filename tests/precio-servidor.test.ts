/** Al agendar, el precio y el nombre del servicio los fija el servidor; lo que mande el navegador se ignora. */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Query } from "./fake-db";

const NEGOCIO = "b0000000-0000-0000-0000-000000000001";
const SUCURSAL = "d0000000-0000-0000-0000-000000000001";
const SERVICIO = "e0000000-0000-0000-0000-000000000001"; // $250, de la sucursal
const GRATIS = "e0000000-0000-0000-0000-000000000002"; // $0, sin sucursal
const AJENO = "e0000000-0000-0000-0000-000000000003"; // de otro negocio
const TARJETA = "f0000000-0000-0000-0000-000000000001";

const SERVICIOS: Record<string, { negocio: string; sucursal: string | null; nombre: string; precio: string }> = {
  [SERVICIO]: { negocio: NEGOCIO, sucursal: SUCURSAL, nombre: "Corte clásico", precio: "250.00" },
  [GRATIS]: { negocio: NEGOCIO, sucursal: null, nombre: "Valoración", precio: "0.00" },
  [AJENO]: { negocio: "b0000000-0000-0000-0000-00000000000f", sucursal: null, nombre: "Ajeno", precio: "10.00" },
};

const estado = vi.hoisted(() => ({ saldo: 1000, queries: [] as Array<{ text: string; values: unknown[] }> }));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(async () => ({ user: { id: "c0000000-0000-0000-0000-000000000001", accountType: "cliente" } })),
  default: vi.fn(),
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
  if (t.includes("FROM stylehub_users") && t.includes("account_type = 'negocio'")) return q.values[0] === NEGOCIO ? [{ id: NEGOCIO }] : [];
  if (t.includes("FROM stylehub_business_branches")) return q.values[0] === SUCURSAL && q.values[1] === NEGOCIO ? [{ id: SUCURSAL }] : [];
  if (t.includes("FROM stylehub_business_services")) {
    const [id, negocio, sucursal] = q.values as string[];
    const s = SERVICIOS[id];
    const conSucursal = t.includes("branch_id = $?");
    if (!s || s.negocio !== negocio || (conSucursal && s.sucursal !== sucursal)) return [];
    return [{ id, service_name: s.nombre, price: s.precio }];
  }
  if (t.includes("FROM stylehub_client_appointments")) return []; // sin conflictos de horario
  if (t.includes("FROM stylehub_client_payment_methods")) return q.values[0] === TARJETA ? [{ id: TARJETA, provider: "card" }] : [];
  if (t.startsWith("SELECT id, balance FROM stylehub_client_wallets")) return [{ id: "w1", balance: String(estado.saldo) }];
  if (t.startsWith("UPDATE stylehub_client_wallets")) {
    const monto = Number(q.values[0]);
    if (estado.saldo < monto) return [];
    estado.saldo -= monto;
    return [{ id: "w1" }];
  }
  if (t.startsWith("INSERT INTO stylehub_client_appointments")) return [{ id: "cita1" }];
  return [];
}

const MANANA = new Date(Date.now() + 86_400_000).toISOString();

async function agendar(cuerpo: Record<string, unknown>) {
  const { POST } = await import("@/app/api/client/appointments/route");
  // El handler está tipado como Response | undefined; en estas rutas siempre responde
  return (await POST(
    new Request("http://localhost/api/client/appointments", {
      method: "POST",
      body: JSON.stringify({ businessUserId: NEGOCIO, scheduledAt: MANANA, ...cuerpo }),
    }),
  )) as Response;
}

const citaGuardada = () => estado.queries.find((q) => q.text.startsWith("INSERT INTO stylehub_client_appointments"));
// Orden de VALUES: cliente, negocio, sucursal, servicio, nombre, fecha, monto, método, proveedor, notas
const campos = (q: Query) => ({ nombre: q.values[4], monto: q.values[6], metodo: q.values[7], proveedor: q.values[8] });

beforeEach(() => {
  estado.saldo = 1000;
  estado.queries = [];
});

describe("POST /api/client/appointments: el servidor fija el precio", () => {
  it("ignora un precio y un nombre alterados y guarda los del servicio", async () => {
    const r = await agendar({ serviceId: SERVICIO, branchId: SUCURSAL, totalAmount: 1, serviceName: "Lo que yo quiera" });
    expect(r.status).toBe(201);
    expect(campos(citaGuardada()!)).toMatchObject({ nombre: "Corte clásico", monto: 250, proveedor: "cash" });
  });

  it("el monedero cobra el precio real, no el que manda el navegador", async () => {
    const r = await agendar({ serviceId: SERVICIO, branchId: SUCURSAL, totalAmount: 1, paymentProvider: "wallet" });
    expect(r.status).toBe(201);
    expect(estado.saldo).toBe(750);
    const debito = estado.queries.find((q) => q.text.startsWith("INSERT INTO stylehub_client_wallet_transactions"))!;
    expect(debito.values).toContain(250);
  });

  it("con saldo insuficiente para el precio real responde 400 y no crea la cita", async () => {
    estado.saldo = 100;
    const r = await agendar({ serviceId: SERVICIO, branchId: SUCURSAL, totalAmount: 50, paymentProvider: "wallet" });
    expect(r.status).toBe(400);
    expect(estado.saldo).toBe(100);
    expect(citaGuardada()).toBeUndefined();
  });

  it("un servicio de $0 se reserva sin cobro aunque se elija monedero o tarjeta", async () => {
    for (const pago of [{ paymentProvider: "wallet" }, { paymentProvider: "card", paymentMethodId: TARJETA }]) {
      estado.queries = [];
      const r = await agendar({ serviceId: GRATIS, ...pago });
      expect(r.status).toBe(201);
      expect(campos(citaGuardada()!)).toMatchObject({ nombre: "Valoración", monto: 0, proveedor: "free", metodo: null });
      expect(estado.queries.some((q) => q.text.includes("stylehub_client_wallet"))).toBe(false);
    }
    expect(estado.saldo).toBe(1000);
  });

  it.each([
    ["sin servicio", {}],
    ["servicio de otro negocio", { serviceId: AJENO }],
    ["servicio que no es de la sucursal elegida", { serviceId: GRATIS, branchId: SUCURSAL }],
    ["identificador de servicio mal formado", { serviceId: "1 OR 1=1" }],
    ["identificador de sucursal mal formado", { serviceId: SERVICIO, branchId: "x" }],
  ])("%s: responde 400 y no crea la cita", async (_caso, cuerpo) => {
    const r = await agendar(cuerpo);
    expect(r.status).toBe(400);
    expect(citaGuardada()).toBeUndefined();
  });

  it("el identificador mal formado no llega a la base", async () => {
    await agendar({ serviceId: "1 OR 1=1" });
    expect(estado.queries.some((q) => q.text.includes("stylehub_business_services"))).toBe(false);
  });
});
