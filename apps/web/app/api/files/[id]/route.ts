import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-auth";
import { obtenerSesion } from "@/lib/sesion";
import { esUuid, leerArchivo } from "@/lib/storage";

export const runtime = "nodejs";

const NO_ENCONTRADO = () => NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });

/**
 * Sirve un archivo subido (lib/storage.ts).
 * - Imagen de sucursal: pública.
 * - Comprobante de propiedad: solo el negocio dueño y la administración. Sin sesión, 401; cualquier
 *   otra cuenta recibe 404 (no se revela si el archivo existe). Se descarga como adjunto.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!esUuid(id)) {
    return NO_ENCONTRADO();
  }

  const archivo = await leerArchivo(id);
  if (!archivo) {
    return NO_ENCONTRADO();
  }

  const extension = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[
    archivo.content_type
  ] ?? "bin";
  const encabezados: Record<string, string> = {
    "Content-Type": archivo.content_type,
    "Content-Length": String(archivo.datos.byteLength),
    "X-Content-Type-Options": "nosniff",
    // Aunque el contenido ya se validó, que el navegador nunca ejecute nada que venga de un archivo subido
    "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
  };

  if (archivo.kind === "branch_proof") {
    const session = await obtenerSesion();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
    }
    const esDueno = session.user.id === archivo.owner_user_id;
    const esAdmin = !esDueno && session.user.accountType === "admin" && !("error" in (await requireAdmin()));
    if (!esDueno && !esAdmin) {
      return NO_ENCONTRADO();
    }
    encabezados["Cache-Control"] = "private, no-store";
    encabezados["Content-Disposition"] = `attachment; filename="comprobante.${extension}"`;
  } else {
    // El id cambia con cada archivo nuevo, así que la imagen nunca cambia bajo la misma URL
    encabezados["Cache-Control"] = "public, max-age=31536000, immutable";
    encabezados["Content-Disposition"] = `inline; filename="imagen.${extension}"`;
  }

  return new NextResponse(new Uint8Array(archivo.datos), { status: 200, headers: encabezados });
}
