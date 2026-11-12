// Crea una cuenta de administración (o le pone contraseña nueva si ya es de administración).
//
//   npm run crear-admin -- correo@dominio.com "Nombre"
//
// Lee DATABASE_URL de .env.local. La contraseña sale de CREAR_ADMIN_PASSWORD (12+ caracteres) o,
// si no se define, se genera una al azar y se muestra una sola vez. No convierte en administración
// una cuenta de cliente o negocio existente.
//
// El hash usa el mismo formato que lib/password.ts (scrypt$sal$clave); tests/crear-admin.test.ts
// comprueba que verifyPassword lo acepte.
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derivedKey}`;
}

export function generarPassword() {
  return crypto.randomBytes(18).toString("base64url");
}

/**
 * Devuelve "creada" o "actualizada".
 * @param {(strings: TemplateStringsArray, ...values: unknown[]) => Promise<any[]>} db función de consulta con plantillas (la de @neondatabase/serverless)
 * @param {{ email: string, nombre?: string, password: string }} datos
 */
export async function crearAdmin(db, { email, nombre, password }) {
  const correo = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    throw new Error("Indica un correo válido.");
  }
  if (!password || password.length < 12) {
    throw new Error("La contraseña debe tener al menos 12 caracteres.");
  }

  // Igual que ensureStylehubSchema(): que la restricción acepte el tipo admin
  await db`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'stylehub_users_account_type_check'
          AND pg_get_constraintdef(oid) LIKE '%admin%'
      ) THEN
        ALTER TABLE stylehub_users DROP CONSTRAINT IF EXISTS stylehub_users_account_type_check;
        ALTER TABLE stylehub_users ADD CONSTRAINT stylehub_users_account_type_check
          CHECK (account_type IN ('cliente', 'negocio', 'admin'));
      END IF;
    END $$;
  `;

  const [existente] = await db`SELECT id, account_type FROM stylehub_users WHERE email = ${correo} LIMIT 1`;
  if (existente && existente.account_type !== "admin") {
    throw new Error(`Ese correo ya es una cuenta de ${existente.account_type}; usa otro correo para administración.`);
  }

  const hash = hashPassword(password);
  if (existente) {
    await db`
      UPDATE stylehub_users
      SET password_hash = ${hash}, is_banned = FALSE, updated_at = NOW()
      WHERE id = ${existente.id}
    `;
    return "actualizada";
  }

  await db`
    INSERT INTO stylehub_users (account_type, first_name, email, password_hash, email_verified, verified_at)
    VALUES ('admin', ${nombre || "Administración"}, ${correo}, ${hash}, TRUE, NOW())
  `;
  return "creada";
}

async function main() {
  const [email, nombre] = process.argv.slice(2);
  if (!email) {
    console.error('Uso: npm run crear-admin -- correo@dominio.com "Nombre"');
    process.exit(2);
  }
  if (!process.env.DATABASE_URL) {
    console.error("Falta DATABASE_URL (en .env.local).");
    process.exit(2);
  }
  const { neon } = await import("@neondatabase/serverless");
  const generada = !process.env.CREAR_ADMIN_PASSWORD;
  const password = process.env.CREAR_ADMIN_PASSWORD || generarPassword();
  try {
    const resultado = await crearAdmin(neon(process.env.DATABASE_URL), { email, nombre, password });
    console.log(`Cuenta de administración ${resultado}: ${email.trim().toLowerCase()}`);
    if (generada) {
      console.log(`Contraseña (se muestra solo esta vez, guárdala en tu gestor): ${password}`);
    }
  } catch (error) {
    if (error?.code === "42P01") {
      console.error("La tabla de usuarios no existe todavía: arranca la app una vez (npm run dev) y repite.");
    } else {
      console.error(error instanceof Error ? error.message : error);
    }
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
