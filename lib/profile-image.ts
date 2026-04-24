import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export async function saveProfileImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("La imagen de perfil debe ser un archivo de imagen válido.");
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("La imagen de perfil no puede pesar más de 5MB.");
  }

  const extension = path.extname(file.name) || ".jpg";
  const fileName = `${Date.now()}-${randomUUID()}${extension}`;
  const relativeDir = path.join("uploads", "profiles");
  const outputDir = path.join(process.cwd(), "public", relativeDir);
  const outputPath = path.join(outputDir, fileName);

  await mkdir(outputDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(outputPath, buffer);

  return `/${relativeDir.replaceAll(path.sep, "/")}/${fileName}`;
}