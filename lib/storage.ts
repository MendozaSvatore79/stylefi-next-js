import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";

/**
 * Archivos subidos por los usuarios. Hoy se guardan en Postgres (tabla stylehub_files); para pasar
 * a un bucket (S3/R2) basta con reimplementar guardarArchivo() y leerArchivo() aquí.
 *
 * Reglas (tests/storage.test.ts):
 * - El tipo se detecta por el contenido (primeros bytes), nunca por el nombre ni por lo que diga el
 *   navegador; la extensión sale del tipo detectado. SVG, HTML y cualquier otro tipo se rechazan.
 * - Máximo 4 MB (Vercel corta las peticiones de más de ~4.5 MB).
 * - Se sirven desde /api/files/[id]: las imágenes de sucursal son públicas; los comprobantes solo los
 *   ven el negocio dueño y la administración.
 */
export const MAX_BYTES = 4 * 1024 * 1024;

export type TipoArchivo = "branch_image" | "branch_proof";
export type TipoDetectado = { mime: string; extension: string };

const PERMITIDOS: Record<TipoArchivo, string[]> = {
  branch_image: ["image/png", "image/jpeg", "image/webp"],
  branch_proof: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
};

export class ArchivoInvalido extends Error {}

function empiezaCon(buffer: Uint8Array, bytes: number[], desde = 0) {
  return bytes.every((b, i) => buffer[desde + i] === b);
}

export function detectarTipo(buffer: Uint8Array): TipoDetectado | null {
  if (empiezaCon(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", extension: "png" };
  if (empiezaCon(buffer, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", extension: "jpg" };
  // RIFF....WEBP
  if (empiezaCon(buffer, [0x52, 0x49, 0x46, 0x46]) && empiezaCon(buffer, [0x57, 0x45, 0x42, 0x50], 8)) {
    return { mime: "image/webp", extension: "webp" };
  }
  if (empiezaCon(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { mime: "application/pdf", extension: "pdf" }; // %PDF-
  return null;
}

/** Valida el archivo y devuelve sus bytes y tipo, o lanza ArchivoInvalido con un mensaje para el usuario. */
export async function validarArchivo(file: File, tipo: TipoArchivo) {
  if (file.size > MAX_BYTES) {
    throw new ArchivoInvalido("El archivo no puede pesar más de 4 MB.");
  }
  const datos = new Uint8Array(await file.arrayBuffer());
  if (datos.byteLength > MAX_BYTES) {
    throw new ArchivoInvalido("El archivo no puede pesar más de 4 MB.");
  }
  const detectado = detectarTipo(datos);
  if (!detectado || !PERMITIDOS[tipo].includes(detectado.mime)) {
    throw new ArchivoInvalido(
      tipo === "branch_proof"
        ? "El comprobante debe ser un PDF o una imagen (JPG, PNG o WebP)."
        : "La imagen debe ser JPG, PNG o WebP.",
    );
  }
  return { datos, ...detectado };
}

/** Guarda el archivo del usuario y devuelve la URL con la que se sirve. */
export async function guardarArchivo(ownerUserId: string, tipo: TipoArchivo, file: File): Promise<string> {
  const { datos, mime } = await validarArchivo(file, tipo);
  await ensureStylehubSchema();
  const db = getDb();
  const [fila] = (await db`
    INSERT INTO stylehub_files (owner_user_id, kind, content_type, size_bytes, data)
    VALUES (${ownerUserId}, ${tipo}, ${mime}, ${datos.byteLength}, decode(${Buffer.from(datos).toString("base64")}, 'base64'))
    RETURNING id
  `) as Array<{ id: string }>;
  return urlDeArchivo(fila.id);
}

export type ArchivoGuardado = {
  id: string;
  owner_user_id: string;
  kind: TipoArchivo;
  content_type: string;
  datos: Buffer;
};

export async function leerArchivo(id: string): Promise<ArchivoGuardado | null> {
  await ensureStylehubSchema();
  const db = getDb();
  const [fila] = (await db`
    SELECT id, owner_user_id, kind, content_type, encode(data, 'base64') AS data_base64
    FROM stylehub_files
    WHERE id = ${id}
    LIMIT 1
  `) as Array<Omit<ArchivoGuardado, "datos"> & { data_base64: string }>;
  if (!fila) return null;
  const { data_base64, ...resto } = fila;
  return { ...resto, datos: Buffer.from(data_base64, "base64") };
}

/** Borra un archivo propio que dejó de usarse (p. ej. al reemplazar el comprobante). */
export async function borrarArchivoPropio(url: string | null | undefined, ownerUserId: string) {
  const id = idDeUrl(url);
  if (!id) return;
  const db = getDb();
  await db`DELETE FROM stylehub_files WHERE id = ${id} AND owner_user_id = ${ownerUserId}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function urlDeArchivo(id: string) {
  return `/api/files/${id}`;
}

export function idDeUrl(url: string | null | undefined): string | null {
  const id = url?.match(/^\/api\/files\/([^/?#]+)$/)?.[1];
  return id && UUID.test(id) ? id : null;
}

export function esUuid(valor: string) {
  return UUID.test(valor);
}

/** URL de imagen escrita a mano: solo https:// (nada de javascript:, data: ni http://). */
export function urlDeImagenValida(valor: string | null | undefined): boolean {
  if (!valor) return true;
  try {
    const url = new URL(valor);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}
