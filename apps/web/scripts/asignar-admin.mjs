// Asigna el rol de administración a un correo. Solo desde la terminal: la app nunca da este permiso.
//
//   npm run asignar-admin -- correo@dominio.com "Nombre"
//
// Lee DATABASE_URL de .env.local. Si el correo no tiene cuenta, crea una cuenta de administración (sin
// contraseña: la persona entra con Clerk usando ese correo y, al verificarlo, queda vinculada). Si ya es de
// administración, no cambia nada. No convierte en administración una cuenta de cliente o negocio.
import { pathToFileURL } from "node:url";

/**
 * Devuelve "creada" o "ya-era-admin".
 * @param {(strings: TemplateStringsArray, ...values: unknown[]) => Promise<any[]>} db función de consulta con plantillas (postgres)
 * @param {{ email: string; nombre?: string }} datos
 */
export async function asignarAdmin(db, { email, nombre }) {
  const correo = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new Error(`Correo inválido: ${email}`);
  const [existente] = await db`SELECT id, account_type FROM stylehub_users WHERE email = ${correo} LIMIT 1`;
  if (existente) {
    if (existente.account_type !== "admin") {
      throw new Error(`${correo} ya es una cuenta de ${existente.account_type}; no se convierte en administración.`);
    }
    return "ya-era-admin";
  }
  await db`
    INSERT INTO stylehub_users (account_type, first_name, email, email_verified, verified_at, onboarding_seen)
    VALUES ('admin', ${nombre?.trim() || null}, ${correo}, TRUE, NOW(), TRUE)
  `;
  return "creada";
}

async function main() {
  const [email, nombre] = process.argv.slice(2);
  if (!email) {
    console.error('Uso: npm run asignar-admin -- correo@dominio.com "Nombre"');
    process.exit(2);
  }
  if (!process.env.DATABASE_URL) {
    console.error("Falta DATABASE_URL (en .env.local).");
    process.exit(2);
  }
  const { default: postgres } = await import("postgres");
  const url = process.env.DATABASE_URL;
  const local = ["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname.replace(/^\[|\]$/g, ""));
  const sql = postgres(url, { max: 1, connect_timeout: 10, ssl: local ? false : "require" });
  let codigo = 0;
  try {
    const r = await asignarAdmin(sql, { email, nombre });
    console.log(
      r === "creada"
        ? `Cuenta de administración creada para ${email.trim().toLowerCase()}. Entra con Clerk usando ese correo (al verificarlo queda vinculada).`
        : `${email.trim().toLowerCase()} ya era de administración; no se cambió nada.`,
    );
  } catch (error) {
    console.error(error?.code === "42P01" ? "La tabla de usuarios no existe todavía: corre las migraciones (synova-backend)." : error instanceof Error ? error.message : error);
    codigo = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
  process.exit(codigo);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
