/**
 * lib/cobro-directo.ts contra PostgreSQL real (base temporal) y un Stripe falso que recuerda las claves de
 * idempotencia como el real. Solo corre con PRUEBAS_ADMIN_DATABASE_URL apuntando a una base LOCAL:
 *   PRUEBAS_ADMIN_DATABASE_URL=postgres://stylefi:stylefi-local@127.0.0.1:54329/stylefi npx vitest run tests/cobro-directo-postgres.test.ts
 */
import { randomUUID } from "node:crypto";

import postgres from "postgres";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const ADMIN = process.env.PRUEBAS_ADMIN_DATABASE_URL;
const local = !!ADMIN && ["localhost", "127.0.0.1", "::1"].includes(new URL(ADMIN).hostname);
const NOMBRE = `prueba_cobro_${Date.now()}_${randomUUID().slice(0, 8)}`;

type Resultado = { status: string } | { error: object };

function crearStripeFalso() {
  const recordadas = new Map<string, { firma: string; intent?: object; error?: object }>();
  let n = 0;
  const estado = { cargos: 0, responder: (): Resultado => ({ status: "succeeded" }), perderRespuesta: false };
  const create = vi.fn(async (params: object, opciones?: { idempotencyKey?: string }) => {
    const clave = opciones?.idempotencyKey;
    const firma = JSON.stringify(params);
    const previa = clave ? recordadas.get(clave) : undefined;
    if (previa) {
      if (previa.firma !== firma) throw Object.assign(new Error("Keys reused"), { type: "StripeIdempotencyError" });
      if (previa.error) throw previa.error;
      return previa.intent;
    }
    await new Promise((listo) => setTimeout(listo, 30));
    const r = estado.responder();
    if ("error" in r) {
      if (clave) recordadas.set(clave, { firma, error: r.error });
      throw r.error;
    }
    const intent = { id: `pi_${++n}`, ...r };
    if (intent.status === "succeeded") estado.cargos++;
    if (clave) recordadas.set(clave, { firma, intent });
    if (estado.perderRespuesta) throw Object.assign(new Error("socket hang up"), { type: "StripeConnectionError" });
    return intent;
  });
  return { stripe: { paymentIntents: { create } } as never, create, estado };
}

describe.skipIf(!local)("cobro directo sin doble cargo (PostgreSQL real)", () => {
  let sql: postgres.Sql;
  let modulo: typeof import("@/lib/cobro-directo");
  let falso: ReturnType<typeof crearStripeFalso>;
  let cliente = "";
  let monedero = "";
  let tarjeta = "";

  const saldo = async () => Number((await sql`SELECT balance FROM stylehub_client_wallets WHERE id = ${monedero}`)[0].balance);
  const estados = async () => (await sql`SELECT status FROM stylehub_client_wallet_transactions ORDER BY created_at`).map((r) => r.status);
  const fallarSaldo = async (veces: number) => {
    await sql`SELECT setval('prueba_fallas', 1, false)`;
    await sql`UPDATE prueba_control SET limite = ${veces}`;
  };
  const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const cobrar = (requestId: string, monto = 150) =>
    modulo.cobroDirecto(sql, falso.stripe, {
      userId: cliente,
      walletId: monedero,
      monto,
      metodo: { id: tarjeta, token: "pm_1" },
      customerId: "cus_1",
      requestId,
      notas: "Recarga con tarjeta guardada",
    });

  beforeAll(async () => {
    const admin = postgres(ADMIN!, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE DATABASE ${NOMBRE}`);
    await admin.end();
    const url = new URL(ADMIN!);
    url.pathname = `/${NOMBRE}`;
    process.env.DATABASE_URL = url.toString();
    const { ensureStylehubSchema } = await import("@/lib/db-init");
    await ensureStylehubSchema();
    modulo = await import("@/lib/cobro-directo");
    sql = postgres(url.toString(), { max: 6, onnotice: () => {} });
    [{ id: cliente }] = await sql`
      INSERT INTO stylehub_users (account_type, email, email_verified, stripe_customer_id)
      VALUES ('cliente', 'c@prueba.invalid', TRUE, 'cus_1') RETURNING id
    `;
    [{ id: monedero }] = await sql`INSERT INTO stylehub_client_wallets (user_id) VALUES (${cliente}) RETURNING id`;
    [{ id: tarjeta }] = await sql`
      INSERT INTO stylehub_client_payment_methods (user_id, provider, card_brand, card_last4, token_reference, is_default)
      VALUES (${cliente}, 'card', 'visa', '4242', 'pm_1', TRUE) RETURNING id
    `;
    await sql.unsafe(`
      CREATE SEQUENCE prueba_fallas;
      CREATE TABLE prueba_control (limite int NOT NULL);
      INSERT INTO prueba_control VALUES (0);
      CREATE FUNCTION prueba_falla() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF nextval('prueba_fallas') <= (SELECT limite FROM prueba_control) THEN RAISE EXCEPTION 'falla provocada'; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER prueba_falla_saldo BEFORE UPDATE ON stylehub_client_wallets
        FOR EACH ROW WHEN (NEW.balance IS DISTINCT FROM OLD.balance) EXECUTE FUNCTION prueba_falla();
    `);
  }, 120_000);

  beforeEach(async () => {
    falso = crearStripeFalso();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fallarSaldo(0);
    await sql`DELETE FROM stylehub_client_wallet_transactions`;
    await sql`UPDATE stylehub_client_wallets SET balance = 0`;
  });

  afterAll(async () => {
    await sql?.end();
    const { getDb } = await import("@/lib/db");
    await (getDb() as unknown as { end: () => Promise<void> }).end();
    const admin = postgres(ADMIN!, { max: 1, onnotice: () => {} });
    await admin.unsafe(`DROP DATABASE IF EXISTS ${NOMBRE} WITH (FORCE)`);
    await admin.end();
  }, 60_000);

  it("cobra y suma; repetir el mismo intento no cobra otra vez", async () => {
    expect(await cobrar(id(1))).toBe("acreditada");
    expect(await cobrar(id(1))).toBe("acreditada");
    expect(falso.estado.cargos).toBe(1);
    expect(await saldo()).toBe(150);
    expect(falso.create.mock.calls[0][1]).toEqual({ idempotencyKey: `recarga-${cliente}-${id(1)}` });
  });

  it("tres peticiones simultáneas del mismo intento: un solo cargo y una sola recarga", async () => {
    expect(await Promise.all([cobrar(id(2)), cobrar(id(2)), cobrar(id(2))])).toEqual(["acreditada", "acreditada", "acreditada"]);
    expect(falso.estado.cargos).toBe(1);
    expect(await saldo()).toBe(150);
    expect(await estados()).toEqual(["completed"]);
  });

  it("el mismo intento con otro monto: RecargaDistinta", async () => {
    await cobrar(id(3), 150);
    await expect(cobrar(id(3), 200)).rejects.toBeInstanceOf(modulo.RecargaDistinta);
  });

  it("tarjeta rechazada o que pide autenticación: «failed», sin cargo (se abre Checkout)", async () => {
    falso.estado.responder = () => ({ error: Object.assign(new Error("declined"), { type: "StripeCardError" }) });
    expect(await cobrar(id(4))).toBe("no-cobrada");
    falso.estado.responder = () => ({ status: "requires_action" });
    expect(await cobrar(id(5))).toBe("no-cobrada");
    expect(await estados()).toEqual(["failed", "failed"]);
    expect(falso.estado.cargos).toBe(0);
  });

  it("falla momentánea al sumar: se resuelve con los reintentos", async () => {
    await fallarSaldo(2);
    expect(await cobrar(id(6))).toBe("acreditada");
    expect(await saldo()).toBe(150);
  });

  it("Stripe cobró y la base sigue fallando: «En proceso»; al abrir Pagos se completa sin otro cargo", async () => {
    await fallarSaldo(1000);
    expect(await cobrar(id(7))).toBe("en-proceso");
    expect(await estados()).toEqual(["pending"]);
    await fallarSaldo(0);
    await modulo.reconciliarRecargas(sql, falso.stripe, cliente);
    expect(await estados()).toEqual(["completed"]);
    expect(await saldo()).toBe(150);
    expect(falso.estado.cargos).toBe(1);
  });

  it("se perdió la respuesta de Stripe (sí cobró): «En proceso» y luego se completa, sin otro cargo", async () => {
    falso.estado.perderRespuesta = true;
    expect(await cobrar(id(8))).toBe("en-proceso");
    falso.estado.perderRespuesta = false;
    await modulo.reconciliarRecargas(sql, falso.stripe, cliente);
    expect(await saldo()).toBe(150);
    expect(falso.estado.cargos).toBe(1);
  });
});
