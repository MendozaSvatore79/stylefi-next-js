// Datos de demostración para la base LOCAL (Docker): un negocio con sucursal aprobada, tres servicios,
// dos estilistas con horario y una cuenta de cliente con $1,000 en el monedero.
//
//   npm run db:arriba && npm run demo
//
// Se puede correr varias veces: no duplica nada. En cada corrida genera contraseñas nuevas para las
// dos cuentas de demostración y las muestra una sola vez. Se niega a correr contra una base que no
// sea local (localhost / 127.0.0.1), para que nunca llegue a producción.
import { pathToFileURL } from "node:url";

import { generarPassword, hashPassword } from "./crear-admin.mjs";

export const CUENTAS = {
  negocio: "negocio@demo.stylefi.invalid",
  cliente: "cliente@demo.stylefi.invalid",
};
const NEGOCIO = "Barbería Demo";
const SUCURSAL = "Sucursal Centro (demo)";
const SERVICIOS = [
  { nombre: "Corte de cabello", precio: 250, minutos: 30 },
  { nombre: "Arreglo de barba", precio: 150, minutos: 30 },
  { nombre: "Corte y barba", precio: 350, minutos: 60 },
];
const ESTILISTAS = [
  { nombre: "Ana", apellido: "López", especialidad: "Cortes clásicos", anios: 6 },
  { nombre: "Beto", apellido: "Ruiz", especialidad: "Barba y degradados", anios: 4 },
];
// day_of_week: 0 = lunes … 5 = sábado. Dos bloques por día: el hueco de 14:00 a 15:00 es la comida.
const HORARIO = [0, 1, 2, 3, 4, 5].flatMap((d) => [
  { d, inicio: "10:00", fin: "14:00" },
  { d, inicio: "15:00", fin: "19:00" },
]);
const SALDO_INICIAL = 1000;

export function esBaseLocal(url) {
  const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
  return ["localhost", "127.0.0.1", "::1"].includes(host);
}

async function cuenta(tx, { tipo, email, nombre, apellido, negocio, password }) {
  const [existente] = await tx`SELECT id, account_type FROM stylehub_users WHERE email = ${email}`;
  if (existente && existente.account_type !== tipo) {
    throw new Error(`${email} ya existe como ${existente.account_type}; no se toca.`);
  }
  const hash = hashPassword(password);
  if (existente) {
    await tx`UPDATE stylehub_users SET password_hash = ${hash}, email_verified = TRUE, is_banned = FALSE, updated_at = NOW() WHERE id = ${existente.id}`;
    return existente.id;
  }
  const [nueva] = await tx`
    INSERT INTO stylehub_users (account_type, first_name, last_name, business_name, email, password_hash, email_verified, verified_at, onboarding_seen)
    VALUES (${tipo}, ${nombre}, ${apellido}, ${negocio ?? null}, ${email}, ${hash}, TRUE, NOW(), TRUE)
    RETURNING id
  `;
  return nueva.id;
}

/** Busca una fila por sus claves; si no existe, la inserta. Devuelve el id. */
async function buscarOCrear(tx, buscar, crear) {
  const [fila] = await buscar();
  if (fila) return fila.id;
  const [nueva] = await crear();
  return nueva.id;
}

/** Crea o completa los datos de demostración. Devuelve un resumen. */
export async function sembrarDemo(sql, passwords) {
  return sql.begin(async (tx) => {
    const negocioId = await cuenta(tx, {
      tipo: "negocio", email: CUENTAS.negocio, nombre: "Dueña", apellido: "Demo", negocio: NEGOCIO, password: passwords.negocio,
    });
    const clienteId = await cuenta(tx, {
      tipo: "cliente", email: CUENTAS.cliente, nombre: "Cliente", apellido: "Demo", password: passwords.cliente,
    });

    const sucursalId = await buscarOCrear(
      tx,
      () => tx`SELECT id FROM stylehub_business_branches WHERE business_user_id = ${negocioId} AND branch_name = ${SUCURSAL}`,
      () => tx`
        INSERT INTO stylehub_business_branches
          (business_user_id, branch_name, description, address, city, state, postal_code, phone,
           opening_hours, closing_hours, validation_status, verified_at, verified_by, is_primary)
        VALUES (${negocioId}, ${SUCURSAL}, ${"Sucursal de demostración para pruebas locales."}, ${"Av. Demo 123"},
          ${"Ciudad de México"}, ${"CDMX"}, ${"06000"}, ${"5500000000"}, ${"10:00"}, ${"19:00"},
          'approved', NOW(), ${"demo"}, TRUE)
        RETURNING id
      `,
    );

    const servicioIds = [];
    for (const s of SERVICIOS) {
      servicioIds.push(await buscarOCrear(
        tx,
        () => tx`SELECT id FROM stylehub_business_services WHERE business_user_id = ${negocioId} AND service_name = ${s.nombre}`,
        () => tx`
          INSERT INTO stylehub_business_services (business_user_id, branch_id, service_name, price, duration_minutes)
          VALUES (${negocioId}, ${sucursalId}, ${s.nombre}, ${s.precio}, ${s.minutos})
          RETURNING id
        `,
      ));
    }

    for (const e of ESTILISTAS) {
      const estilistaId = await buscarOCrear(
        tx,
        () => tx`SELECT id FROM stylehub_business_stylists WHERE business_user_id = ${negocioId} AND first_name = ${e.nombre} AND last_name = ${e.apellido}`,
        () => tx`
          INSERT INTO stylehub_business_stylists (business_user_id, branch_id, first_name, last_name, specialization, years_experience, available)
          VALUES (${negocioId}, ${sucursalId}, ${e.nombre}, ${e.apellido}, ${e.especialidad}, ${e.anios}, TRUE)
          RETURNING id
        `,
      );
      await tx`
        INSERT INTO stylehub_stylist_services (stylist_id, service_id)
        SELECT ${estilistaId}::uuid, unnest(${servicioIds}::uuid[])
        ON CONFLICT DO NOTHING
      `;
      const [{ bloques }] = await tx`SELECT count(*)::int AS bloques FROM stylehub_stylist_schedule_blocks WHERE stylist_id = ${estilistaId}`;
      if (bloques === 0) {
        await tx`
          INSERT INTO stylehub_stylist_schedule_blocks (stylist_id, day_of_week, start_time, end_time)
          SELECT ${estilistaId}::uuid, d, s, f
          FROM unnest(${HORARIO.map((h) => h.d)}::smallint[], ${HORARIO.map((h) => h.inicio)}::time[], ${HORARIO.map((h) => h.fin)}::time[]) AS t(d, s, f)
        `;
      }
    }

    // El saldo solo se pone al crear el monedero; en corridas siguientes se respeta lo que haya.
    await tx`INSERT INTO stylehub_client_wallets (user_id, balance) VALUES (${clienteId}, ${SALDO_INICIAL}) ON CONFLICT (user_id) DO NOTHING`;
    const [{ balance }] = await tx`SELECT balance FROM stylehub_client_wallets WHERE user_id = ${clienteId}`;

    return { negocio: NEGOCIO, sucursal: SUCURSAL, servicios: SERVICIOS.length, estilistas: ESTILISTAS.length, saldo: balance };
  });
}

async function esquemaListo(sql) {
  const [{ ok }] = await sql`SELECT to_regclass('public.stylehub_stylist_schedule_blocks') IS NOT NULL AS ok`;
  return ok;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Falta DATABASE_URL (en .env.local).");
    process.exit(2);
  }
  if (!esBaseLocal(url)) {
    console.error("Este script solo corre contra la base local (localhost). DATABASE_URL apunta a otro lado: no se hizo nada.");
    process.exit(2);
  }
  const { default: postgres } = await import("postgres");
  const sql = postgres(url, { max: 1, connect_timeout: 10, ssl: false, onnotice: () => {} });
  let codigo = 0;
  try {
    if (!(await esquemaListo(sql))) {
      // Las tablas las crea la app al arrancar: si está corriendo, una petición basta.
      const app = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
      await fetch(`${app}/api/businesses`).catch(() => null);
      if (!(await esquemaListo(sql))) {
        console.error(`La base no tiene tablas todavía. Arranca la app (npm run dev), abre ${app} y repite npm run demo.`);
        process.exit(1);
      }
    }
    const passwords = { negocio: generarPassword(), cliente: generarPassword() };
    const r = await sembrarDemo(sql, passwords);
    console.log(`Listo: ${r.negocio} · ${r.sucursal} · ${r.servicios} servicios · ${r.estilistas} estilistas (lun–sáb 10–14 y 15–19).`);
    console.log("Contraseñas nuevas (se muestran solo esta vez; la siguiente corrida las cambia):");
    console.log(`  Negocio  ${CUENTAS.negocio}  ${passwords.negocio}`);
    console.log(`  Cliente  ${CUENTAS.cliente}  ${passwords.cliente}  (saldo en monedero: $${r.saldo})`);
    console.log("Para el panel de administración: npm run crear-admin -- tu-correo@dominio.com \"Tu nombre\"");
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    codigo = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
  process.exit(codigo);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
