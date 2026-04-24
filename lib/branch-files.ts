import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const MAX_IMAGE_SIZE_BYTES = 6 * 1024 * 1024;
const MAX_PROOF_SIZE_BYTES = 10 * 1024 * 1024;

async function saveFile(file: File, relativeDir: string, maxSize: number): Promise<string> {
  const extension = path.extname(file.name) || ".bin";
  const fileName = `${Date.now()}-${randomUUID()}${extension}`;
  const outputDir = path.join(process.cwd(), "public", relativeDir);
  const outputPath = path.join(outputDir, fileName);

  await mkdir(outputDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength > maxSize) {
    throw new Error("El archivo excede el tamaño permitido.");
  }

  await writeFile(outputPath, buffer);

  return `/${relativeDir.replaceAll(path.sep, "/")}/${fileName}`;
}

export async function saveBranchImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("La imagen de sucursal debe ser un archivo de imagen válido.");
  }

  return saveFile(file, path.join("uploads", "branches", "images"), MAX_IMAGE_SIZE_BYTES);
}

export async function saveBranchOwnershipProof(file: File): Promise<string> {
  const isAllowedType =
    file.type === "application/pdf" ||
    file.type.startsWith("image/") ||
    file.type === "application/msword" ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  if (!isAllowedType) {
    throw new Error("El comprobante debe ser PDF, imagen o documento Word.");
  }

  return saveFile(file, path.join("uploads", "branches", "proofs"), MAX_PROOF_SIZE_BYTES);
}
