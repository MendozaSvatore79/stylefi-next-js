// Datos de demostración para la base LOCAL (Docker): un negocio con sucursal aprobada, tres servicios,
// dos estilistas con horario y una cuenta de cliente con $1,000 en el monedero.
//
//   npm run db:arriba && npm run demo
//
// Se puede correr varias veces: no duplica nada. Se niega a correr contra una base que no sea local
// (localhost / 127.0.0.1), para que nunca llegue a producción.
//
// Inicio de sesión (Clerk): si CLERK_SECRET_KEY es de una instancia de DESARROLLO (sk_test_), crea o actualiza
// las dos cuentas en Clerk con contraseñas nuevas y las muestra una sola vez. Los correos llevan +clerk_test:
// si Clerk pide un código al entrar, es 424242.
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

export const CUENTAS = {
  negocio: "demo-negocio+clerk_test@example.com",
  cliente: "demo-cliente+clerk_test@example.com",
};
/** Correos de versiones anteriores del script: se renombran a los nuevos para no duplicar datos. */
const CORREOS_ANTERIORES = {
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

async function cuenta(tx, { tipo, email, anterior, nombre, apellido, negocio }) {
  await tx`UPDATE stylehub_users SET email = ${email} WHERE email = ${anterior} AND NOT EXISTS (SELECT 1 FROM stylehub_users WHERE email = ${email})`;
  const [existente] = await tx`SELECT id, account_type FROM stylehub_users WHERE email = ${email}`;
  if (existente && existente.account_type !== tipo) {
    throw new Error(`${email} ya existe como ${existente.account_type}; no se toca.`);
  }
  if (existente) {
    await tx`UPDATE stylehub_users SET email_verified = TRUE, is_banned = FALSE, updated_at = NOW() WHERE id = ${existente.id}`;
    return existente.id;
  }
  const [nueva] = await tx`
    INSERT INTO stylehub_users (account_type, first_name, last_name, business_name, email, email_verified, verified_at, onboarding_seen)
    VALUES (${tipo}, ${nombre}, ${apellido}, ${negocio ?? null}, ${email}, TRUE, NOW(), TRUE)
    RETURNING id
  `;
  return nueva.id;
}

/** Crea la cuenta en Clerk (instancia de desarrollo) o le pone contraseña nueva. Devuelve su id. */
export async function cuentaClerk(secretKey, { email, password, nombre, apellido }) {
  const api = (ruta, init = {}) =>
    fetch(`https://api.clerk.com/v1${ruta}`, {
      ...init,
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
    });
  const busqueda = await api(`/users?email_address=${encodeURIComponent(email)}`);
  if (!busqueda.ok) throw new Error(`Clerk respondió ${busqueda.status} al buscar ${email}.`);
  const [existente] = await busqueda.json();
  const r = existente
    ? await api(`/users/${existente.id}`, { method: "PATCH", body: JSON.stringify({ password, skip_password_checks: true }) })
    : await api("/users", {
        method: "POST",
        body: JSON.stringify({ email_address: [email], password, skip_password_checks: true, first_name: nombre, last_name: apellido }),
      });
  if (!r.ok) throw new Error(`Clerk respondió ${r.status} con ${email}.`);
  return (await r.json()).id;
}

/** Busca una fila por sus claves; si no existe, la inserta. Devuelve el id. */
async function buscarOCrear(tx, buscar, crear) {
  const [fila] = await buscar();
  if (fila) return fila.id;
  const [nueva] = await crear();
  return nueva.id;
}

/** Crea o completa los datos de demostración. Devuelve un resumen. */
export async function sembrarDemo(sql) {
  return sql.begin(async (tx) => {
    const negocioId = await cuenta(tx, {
      tipo: "negocio", email: CUENTAS.negocio, anterior: CORREOS_ANTERIORES.negocio, nombre: "Dueña", apellido: "Demo", negocio: NEGOCIO,
    });
    const clienteId = await cuenta(tx, {
      tipo: "cliente", email: CUENTAS.cliente, anterior: CORREOS_ANTERIORES.cliente, nombre: "Cliente", apellido: "Demo",
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
      const app = "http://localhost:3000";
      await fetch(`${app}/api/businesses`).catch(() => null);
      if (!(await esquemaListo(sql))) {
        console.error(`La base no tiene tablas todavía. Arranca la app (npm run dev), abre ${app} y repite npm run demo.`);
        process.exit(1);
      }
    }
    const r = await sembrarDemo(sql);
    console.log(`Listo: ${r.negocio} · ${r.sucursal} · ${r.servicios} servicios · ${r.estilistas} estilistas (lun–sáb 10–14 y 15–19).`);
    const secreta = process.env.CLERK_SECRET_KEY;
    if (!secreta?.startsWith("sk_test_")) {
      console.log("Sin CLERK_SECRET_KEY de desarrollo (sk_test_): no se crearon las cuentas en Clerk, así que no podrás entrar con ellas.");
    } else {
      const claves = { negocio: crypto.randomBytes(18).toString("base64url"), cliente: crypto.randomBytes(18).toString("base64url") };
      for (const [tipo, nombre] of [["negocio", "Dueña"], ["cliente", "Cliente"]]) {
        const clerkId = await cuentaClerk(secreta, { email: CUENTAS[tipo], password: claves[tipo], nombre, apellido: "Demo" });
        await sql`UPDATE stylehub_users SET clerk_user_id = NULL WHERE clerk_user_id = ${clerkId} AND email <> ${CUENTAS[tipo]}`;
        await sql`UPDATE stylehub_users SET clerk_user_id = ${clerkId} WHERE email = ${CUENTAS[tipo]}`;
      }
      console.log("Contraseñas nuevas en Clerk (se muestran solo esta vez; la siguiente corrida las cambia):");
      console.log(`  Negocio  ${CUENTAS.negocio}  ${claves.negocio}`);
      console.log(`  Cliente  ${CUENTAS.cliente}  ${claves.cliente}  (saldo en monedero: $${r.saldo})`);
      console.log("Si Clerk pide un código al entrar, escribe 424242 (correos de prueba +clerk_test).");
    }
    console.log('Para el panel de administración: npm run asignar-admin -- tu-correo@dominio.com "Tu nombre"');
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
