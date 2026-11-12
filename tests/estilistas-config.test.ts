/** Servicios, horario y ausencias de cada estilista (cambio 4.6): validación y aislamiento por negocio. */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Query } from "./fake-db";

const NEGOCIO = "b0000000-0000-0000-0000-000000000001";
const PROPIO = "a1000000-0000-0000-0000-000000000001";
const AJENO = "a1000000-0000-0000-0000-000000000009";
const SERV_PROPIO = "e0000000-0000-0000-0000-000000000001";
const SERV_AJENO = "e0000000-0000-0000-0000-000000000009";
const AUSENCIA = "f1000000-0000-0000-0000-000000000001";

const estado = vi.hoisted(() => ({ queries: [] as Array<{ text: string; values: unknown[] }>, transacciones: 0 }));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(async () => ({ user: { id: "b0000000-0000-0000-0000-000000000001", accountType: "negocio" } })),
  default: vi.fn(),
}));
vi.mock("@/lib/db-init", () => ({ ensureStylehubSchema: vi.fn(async () => undefined) }));
vi.mock("@/lib/db", () => ({
  getDb: () => {
    const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
      const q = { text: strings.join("$?").replace(/\s+/g, " ").trim(), values };
      estado.queries.push(q);
      return Promise.resolve(responder(q));
    };
    sql.begin = async (fn: (tx: typeof sql) => Promise<unknown[]>[]) => {
      const consultas = fn(sql);
      estado.transacciones++;
      return Promise.all(consultas);
    };
    return sql;
  },
}));

function responder(q: Query): unknown[] {
  const t = q.text;
  if (t.startsWith("SELECT id FROM stylehub_business_stylists")) return q.values[0] === PROPIO && q.values[1] === NEGOCIO ? [{ id: PROPIO }] : [];
  if (t.startsWith("SELECT id FROM stylehub_business_services")) return (q.values[1] as string[]).filter((id) => id === SERV_PROPIO).map((id) => ({ id }));
  if (t.startsWith("SELECT day_of_week")) return [{ day_of_week: 0, start: "10:00", end: "14:00" }];
  if (t.startsWith("INSERT INTO stylehub_stylist_absences")) return [{ id: AUSENCIA, starts_at: q.values[1], ends_at: q.values[2], reason: q.values[3] }];
  if (t.startsWith("DELETE FROM stylehub_stylist_absences")) return q.values[0] === AUSENCIA && q.values[1] === NEGOCIO ? [{ id: AUSENCIA }] : [];
  return [];
}

beforeEach(() => {
  estado.queries = [];
  estado.transacciones = 0;
});

const pedir = async (ruta: string, metodo: string, cuerpo?: unknown, query = "") => {
  const mod = (await import(`@/app/api/business/stylists/${ruta}/route`)) as Record<string, (r: Request) => Promise<Response>>;
  const init: RequestInit = { method: metodo };
  if (cuerpo !== undefined) init.body = JSON.stringify(cuerpo);
  return mod[metodo](new Request(`http://localhost/x${query}`, init));
};

describe("validarBloques", () => {
  it("acepta bloques con descanso entre ellos (y bloques que se tocan)", async () => {
    const { validarBloques } = await import("@/lib/stylist-config");
    expect(validarBloques([{ dayOfWeek: 0, start: "10:00", end: "14:00" }, { dayOfWeek: 0, start: "14:00", end: "19:00" }])).toHaveLength(2);
  });

  it.each([
    [[{ dayOfWeek: 0, start: "10:00", end: "14:00" }, { dayOfWeek: 0, start: "13:00", end: "16:00" }], "enciman"],
    [[{ dayOfWeek: 2, start: "14:00", end: "10:00" }], "terminar después"],
    [[{ dayOfWeek: 7, start: "10:00", end: "14:00" }], "0 (lunes) a 6"],
    [[{ dayOfWeek: 1, start: "25:00", end: "26:00" }], "HH:MM"],
    ["no es lista", "Horario inválido"],
  ])("rechaza %j", async (bloques, mensaje) => {
    const { validarBloques } = await import("@/lib/stylist-config");
    expect(() => validarBloques(bloques)).toThrow(mensaje);
  });
});

describe("ausencias", () => {
  it("una fecha sin zona del navegador se interpreta en hora de México", async () => {
    const { fechaHoraDelNegocio } = await import("@/lib/stylist-config");
    expect(fechaHoraDelNegocio("2030-03-04T10:00")!.toISOString()).toBe("2030-03-04T16:00:00.000Z");
  });

  it.each([
    [{ startsAt: "2030-03-04T12:00", endsAt: "2030-03-04T10:00" }, "terminar después"],
    [{ startsAt: "2030-03-01T10:00", endsAt: "2030-06-15T10:00" }, "90 días"],
    [{ startsAt: "mañana", endsAt: "2030-03-04T10:00" }, "desde y hasta"],
  ])("rechaza %j", async (entrada, mensaje) => {
    const { validarAusencia } = await import("@/lib/stylist-config");
    expect(() => validarAusencia(entrada)).toThrow(mensaje);
  });
});

describe("rutas: solo estilistas y servicios del propio negocio", () => {
  it("la búsqueda del estilista filtra por el negocio de la sesión en el propio SQL", async () => {
    // La base simulada responde por valores; esto asegura que el filtro esté en la consulta real
    await pedir("schedule", "GET", undefined, `?stylistId=${PROPIO}`);
    const q = estado.queries.find((x) => x.text.startsWith("SELECT id FROM stylehub_business_stylists"))!;
    expect(q.text).toMatch(/WHERE id = \$\? AND business_user_id = \$\?/);
    expect(q.values).toEqual([PROPIO, NEGOCIO]);
  });

  it("la validación de servicios filtra por el negocio en el propio SQL", async () => {
    await pedir("services", "PUT", { stylistId: PROPIO, serviceIds: [SERV_PROPIO] });
    const q = estado.queries.find((x) => x.text.startsWith("SELECT id FROM stylehub_business_services"))!;
    expect(q.text).toContain("WHERE business_user_id = $? AND id = ANY($?::uuid[])");
    expect(q.values[0]).toBe(NEGOCIO);
  });

  it.each([
    ["schedule", "GET", undefined, `?stylistId=${AJENO}`],
    ["schedule", "PUT", { stylistId: AJENO, blocks: [] }, ""],
    ["absences", "GET", undefined, `?stylistId=${AJENO}`],
    ["absences", "POST", { stylistId: AJENO, startsAt: "2030-03-04T10:00", endsAt: "2030-03-04T12:00" }, ""],
    ["services", "PUT", { stylistId: AJENO, serviceIds: [] }, ""],
    ["schedule", "GET", undefined, "?stylistId=no-uuid"],
  ])("%s %s con estilista ajeno o inválido responde 404 y no escribe", async (ruta, metodo, cuerpo, query) => {
    expect((await pedir(ruta, metodo, cuerpo, query)).status).toBe(404);
    expect(estado.transacciones).toBe(0);
    expect(estado.queries.some((q) => /^(INSERT|DELETE|UPDATE)/.test(q.text))).toBe(false);
  });

  it("asignar un servicio de otro negocio responde 400 y no cambia nada", async () => {
    const r = await pedir("services", "PUT", { stylistId: PROPIO, serviceIds: [SERV_PROPIO, SERV_AJENO] });
    expect(r.status).toBe(400);
    expect(estado.transacciones).toBe(0);
  });

  it("los servicios propios se reemplazan en una transacción", async () => {
    const r = await pedir("services", "PUT", { stylistId: PROPIO, serviceIds: [SERV_PROPIO, SERV_PROPIO] });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ serviceIds: [SERV_PROPIO] });
    expect(estado.transacciones).toBe(1);
  });

  it("guardar el horario reemplaza la semana completa en una transacción; uno inválido responde 400", async () => {
    expect((await pedir("schedule", "PUT", { stylistId: PROPIO, blocks: [{ dayOfWeek: 0, start: "10:00", end: "14:00" }] })).status).toBe(200);
    expect(estado.transacciones).toBe(1);
    expect((await pedir("schedule", "PUT", { stylistId: PROPIO, blocks: [{ dayOfWeek: 0, start: "14:00", end: "10:00" }] })).status).toBe(400);
    expect(estado.transacciones).toBe(1);
  });

  it("agrega una ausencia en hora de México y solo borra ausencias de sus estilistas", async () => {
    const r = await pedir("absences", "POST", { stylistId: PROPIO, startsAt: "2030-03-04T10:00", endsAt: "2030-03-04T12:00", reason: "Dentista" });
    expect(r.status).toBe(201);
    expect((await r.json()).absence.starts_at).toBe("2030-03-04T16:00:00.000Z");
    expect((await pedir("absences", "DELETE", { id: AUSENCIA })).status).toBe(200);
    expect((await pedir("absences", "DELETE", { id: "f1000000-0000-0000-0000-00000000000f" })).status).toBe(404);
    const borrado = estado.queries.find((q) => q.text.startsWith("DELETE FROM stylehub_stylist_absences"))!;
    expect(borrado.text).toContain("s.business_user_id = $?");
  });
});
