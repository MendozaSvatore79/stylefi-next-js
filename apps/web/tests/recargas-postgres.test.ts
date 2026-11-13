/**
 * lib/recargas.ts contra PostgreSQL real, en una base temporal. Solo corre con PRUEBAS_ADMIN_DATABASE_URL apuntando
 * a una base LOCAL (por ejemplo la de docker compose):
 *   PRUEBAS_ADMIN_DATABASE_URL=postgres://stylefi:stylefi-local@127.0.0.1:54329/stylefi npx vitest run tests/recargas-postgres.test.ts
 * Si una parte de la recarga falla (se provoca con un trigger) no queda nada a medias, y dos acreditaciones a la vez
 * suman una sola vez.
 */
import { randomUUID } from "node:crypto";

import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Sql } from "@/lib/booking";

const ADMIN = process.env.PRUEBAS_ADMIN_DATABASE_URL;
const local = !!ADMIN && ["localhost", "127.0.0.1", "::1"].includes(new URL(ADMIN).hostname);
const NOMBRE = `prueba_recargas_${Date.now()}_${randomUUID().slice(0, 8)}`;

describe.skipIf(!local)("recargas en una sola sentencia (PostgreSQL real)", () => {
  let sql: postgres.Sql;
  let recargas: typeof import("@/lib/recargas");
  let cliente = "";
  let monedero = "";

  const saldo = async () => (await sql`SELECT balance FROM stylehub_client_wallets WHERE id = ${monedero}`)[0].balance as string;
  const pendiente = async (monto: number) =>
    (
      await sql`
        INSERT INTO stylehub_client_wallet_transactions (wallet_id, user_id, transaction_type, amount, payment_provider, status)
        VALUES (${monedero}, ${cliente}, 'recharge', ${monto}, 'stripe', 'pending') RETURNING id
      `
    )[0].id as string;
  const estado = async (id: string) => (await sql`SELECT status FROM stylehub_client_wallet_transactions WHERE id = ${id}`)[0].status;

  beforeAll(async () => {
    const admin = postgres(ADMIN!, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE DATABASE ${NOMBRE}`);
    await admin.end();
    const url = new URL(ADMIN!);
    url.pathname = `/${NOMBRE}`;
    process.env.DATABASE_URL = url.toString();
    const { ensureStylehubSchema } = await import("@/lib/db-init");
    await ensureStylehubSchema();
    recargas = await import("@/lib/recargas");
    sql = postgres(url.toString(), { max: 4, onnotice: () => {} });
    [{ id: cliente }] = await sql`
      INSERT INTO stylehub_users (account_type, email, email_verified) VALUES ('cliente', 'c@prueba.invalid', TRUE) RETURNING id
    `;
    [{ id: monedero }] = await sql`INSERT INTO stylehub_client_wallets (user_id) VALUES (${cliente}) RETURNING id`;
    // Fallas provocadas: el movimiento con notas 'FALLA' y cualquier saldo de $5,000 o más
    await sql.unsafe(`
      CREATE FUNCTION prueba_falla() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'falla provocada'; END $$;
      CREATE TRIGGER prueba_falla_movimiento BEFORE INSERT ON stylehub_client_wallet_transactions
        FOR EACH ROW WHEN (NEW.notes = 'FALLA') EXECUTE FUNCTION prueba_falla();
      CREATE TRIGGER prueba_falla_saldo BEFORE UPDATE ON stylehub_client_wallets
        FOR EACH ROW WHEN (NEW.balance >= 5000) EXECUTE FUNCTION prueba_falla();
    `);
  }, 120_000);

  afterAll(async () => {
    await sql?.end();
    const { getDb } = await import("@/lib/db");
    await (getDb() as unknown as { end: () => Promise<void> }).end();
    const admin = postgres(ADMIN!, { max: 1, onnotice: () => {} });
    await admin.unsafe(`DROP DATABASE IF EXISTS ${NOMBRE} WITH (FORCE)`);
    await admin.end();
  }, 60_000);

  const recarga = (notas: string) =>
    recargas.recargaCompletada(sql as unknown as Sql, {
      walletId: monedero,
      userId: cliente,
      monto: 100,
      paymentMethodId: null,
      proveedor: "mock",
      referencia: null,
      notas,
    });

  it("recarga completada: suma y registra juntos", async () => {
    expect(await recarga("ok")).toEqual({ id: monedero, balance: "100.00", currency: "MXN" });
    const movs = await sql`SELECT amount, status FROM stylehub_client_wallet_transactions WHERE notes = 'ok'`;
    expect([...movs]).toEqual([{ amount: "100.00", status: "completed" }]);
  });

  it("si el registro del movimiento falla, el saldo no cambia", async () => {
    await expect(recarga("FALLA")).rejects.toThrow("falla provocada");
    expect(await saldo()).toBe("100.00");
  });

  it("si sumar el saldo falla, la recarga pendiente sigue pendiente (se puede reintentar)", async () => {
    const id = await pendiente(5000);
    await expect(
      recargas.acreditarRecargaPendiente(sql as unknown as Sql, { txId: id, userId: cliente, sessionId: "cs_x", nota: "n" }),
    ).rejects.toThrow("falla provocada");
    expect(await estado(id)).toBe("pending");
    expect(await saldo()).toBe("100.00");
  });

  it("confirmación y webhook a la vez (5 llamadas): se acredita una sola vez", async () => {
    const id = await pendiente(250);
    const r = await Promise.all(
      [cliente, null, cliente, null, null].map((userId) =>
        recargas.acreditarRecargaPendiente(sql as unknown as Sql, { txId: id, userId, sessionId: "cs_doble", nota: "n" }),
      ),
    );
    expect(r.filter(Boolean)).toHaveLength(1);
    expect(await saldo()).toBe("350.00");
    expect(await estado(id)).toBe("completed");
  });
});
