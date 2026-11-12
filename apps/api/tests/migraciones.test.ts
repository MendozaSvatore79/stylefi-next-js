/**
 * Migraciones contra PostgreSQL real. Crean bases temporales y las borran al terminar.
 * Solo corren con una conexión de administración a una base LOCAL, por ejemplo la de compose.yaml:
 *   PRUEBAS_ADMIN_DATABASE_URL=postgres://stylefi:stylefi-local@127.0.0.1:54329/stylefi npm test -w @stylefi/api
 */
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import { aplicarMigraciones, marcarBase } from "../src/db/migrar.js";

const ADMIN = process.env.PRUEBAS_ADMIN_DATABASE_URL;
const creadas: string[] = [];

function local(url: string) {
  return ["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname);
}

async function baseTemporal() {
  const nombre = `prueba_migraciones_${Date.now()}_${creadas.length}`;
  const admin = postgres(ADMIN!, { max: 1, onnotice: () => {} });
  await admin.unsafe(`CREATE DATABASE ${nombre}`);
  await admin.end();
  creadas.push(nombre);
  const url = new URL(ADMIN!);
  url.pathname = `/${nombre}`;
  return postgres(url.toString(), { max: 1, onnotice: () => {} });
}

const tablas = async (sql: postgres.Sql) =>
  (await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'`)[0].n;

describe.skipIf(!ADMIN || !local(ADMIN))("migraciones (PostgreSQL real)", () => {
  afterAll(async () => {
    const admin = postgres(ADMIN!, { max: 1, onnotice: () => {} });
    for (const nombre of creadas) await admin.unsafe(`DROP DATABASE IF EXISTS ${nombre} WITH (FORCE)`);
    await admin.end();
  });

  it("una base vacía queda con las 23 tablas, la regla anti-traslape y btree_gist; repetir no cambia nada", async () => {
    const sql = await baseTemporal();
    await aplicarMigraciones(sql);
    expect(await tablas(sql)).toBe(23);
    const [{ x }] = await sql`SELECT count(*)::int AS x FROM pg_constraint WHERE conname = 'stylehub_appointments_no_overlap' AND contype = 'x'`;
    expect(x).toBe(1);
    const ext = (await sql`SELECT extname FROM pg_extension`).map((e) => e.extname);
    expect(ext).toEqual(expect.arrayContaining(["pgcrypto", "btree_gist"]));
    await aplicarMigraciones(sql);
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`;
    expect(n).toBe(1);
    await sql.end();
  }, 60_000);

  it("la regla anti-traslape rechaza dos citas encimadas del mismo estilista", async () => {
    const sql = await baseTemporal();
    await aplicarMigraciones(sql);
    const [u] = await sql`INSERT INTO stylehub_users (account_type, email) VALUES ('negocio', 'n@prueba.invalid') RETURNING id`;
    const [c] = await sql`INSERT INTO stylehub_users (account_type, email) VALUES ('cliente', 'c@prueba.invalid') RETURNING id`;
    const [e] = await sql`INSERT INTO stylehub_business_stylists (business_user_id, first_name, last_name) VALUES (${u.id}, 'Ana', 'Prueba') RETURNING id`;
    const cita = (inicio: string, fin: string) => sql`
      INSERT INTO stylehub_client_appointments (client_user_id, business_user_id, stylist_id, service_name, scheduled_at, ends_at, status, total_amount)
      VALUES (${c.id}, ${u.id}, ${e.id}, 'Corte', ${inicio}, ${fin}, 'confirmed', 100)`;
    await cita("2030-01-01T16:00:00Z", "2030-01-01T16:30:00Z");
    await expect(cita("2030-01-01T16:15:00Z", "2030-01-01T16:45:00Z")).rejects.toMatchObject({ code: "23P01" });
    await cita("2030-01-01T16:30:00Z", "2030-01-01T17:00:00Z"); // justo después: sí cabe
    await sql.end();
  }, 60_000);

  it("--marcar-base: registra la 0000 en una base completa, sin tocar tablas, y solo una vez", async () => {
    const sql = await baseTemporal();
    await aplicarMigraciones(sql);
    await sql`DROP SCHEMA drizzle CASCADE`; // simula una base creada por la app vieja
    await marcarBase(sql);
    await aplicarMigraciones(sql); // ya no hay nada pendiente
    expect(await tablas(sql)).toBe(23);
    await expect(marcarBase(sql)).rejects.toThrow(/ya tiene migraciones/);
    await sql.end();
  }, 60_000);

  it("--marcar-base: se niega si a la base le falta algo", async () => {
    const sql = await baseTemporal();
    await sql`CREATE TABLE stylehub_users (id uuid PRIMARY KEY)`;
    await expect(marcarBase(sql)).rejects.toThrow(/no coincide con la versión 0000/);
    const [{ existe }] = await sql`SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS existe`;
    expect(existe).toBe(false);
    await sql.end();
  }, 60_000);
});
