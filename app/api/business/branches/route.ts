import { NextResponse } from "next/server";

import { getCurrentBusinessUser } from "@/app/api/business/_current-user";
import { saveBranchImage, saveBranchOwnershipProof } from "@/lib/branch-files";
import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";

export const runtime = "nodejs";

function parseCoordinate(value: unknown): number | null | undefined {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  const parsed = typeof value === "string" ? Number(value.trim().replace(",", ".")) : Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return parsed;
}

function toText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "on" || normalized === "yes";
  }

  return false;
}

type BranchPayload = {
  id?: string;
  branchName?: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  latitude?: unknown;
  longitude?: unknown;
  phone?: string;
  website?: string;
  imageUrl?: string;
  ownershipProofUrl?: string;
  openingHours?: string;
  closingHours?: string;
  isPrimary?: boolean;
  branchImageFile?: File | null;
  ownershipProofFile?: File | null;
};

async function readPayload(request: Request): Promise<BranchPayload> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const branchImageEntry = formData.get("branchImage");
    const ownershipProofEntry = formData.get("ownershipProof");

    return {
      id: toText(formData.get("id")) || undefined,
      branchName: toText(formData.get("branchName")) || undefined,
      description: toText(formData.get("description")) || undefined,
      address: toText(formData.get("address")) || undefined,
      city: toText(formData.get("city")) || undefined,
      state: toText(formData.get("state")) || undefined,
      postalCode: toText(formData.get("postalCode")) || undefined,
      latitude: toText(formData.get("latitude")) || undefined,
      longitude: toText(formData.get("longitude")) || undefined,
      phone: toText(formData.get("phone")) || undefined,
      website: toText(formData.get("website")) || undefined,
      imageUrl: toText(formData.get("imageUrl")) || undefined,
      ownershipProofUrl: toText(formData.get("ownershipProofUrl")) || undefined,
      openingHours: toText(formData.get("openingHours")) || undefined,
      closingHours: toText(formData.get("closingHours")) || undefined,
      isPrimary: parseBoolean(formData.get("isPrimary")),
      branchImageFile: branchImageEntry instanceof File && branchImageEntry.size > 0 ? branchImageEntry : null,
      ownershipProofFile: ownershipProofEntry instanceof File && ownershipProofEntry.size > 0 ? ownershipProofEntry : null,
    };
  }

  const json = (await request.json()) as BranchPayload;
  return {
    ...json,
    isPrimary: Boolean(json.isPrimary),
    branchImageFile: null,
    ownershipProofFile: null,
  };
}

export async function GET() {
  const auth = await getCurrentBusinessUser();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    await ensureStylehubSchema();
    const db = getDb();

    const branches = await db`
      SELECT
        id,
        branch_name,
        description,
        address,
        city,
        state,
        postal_code,
        latitude,
        longitude,
        phone,
        website,
        image_url,
        ownership_proof_url,
        validation_status,
        validation_notes,
        verified_at,
        opening_hours,
        closing_hours,
        is_primary,
        created_at
      FROM stylehub_business_branches
      WHERE business_user_id = ${auth.userId}
      ORDER BY is_primary DESC, created_at DESC
    `;

    return NextResponse.json({ branches });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudieron cargar las sucursales." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await getCurrentBusinessUser();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    await ensureStylehubSchema();
    const db = getDb();
    const payload = await readPayload(request);

    const branchName = payload.branchName?.trim();
    if (!branchName) {
      return NextResponse.json({ error: "El nombre de la sucursal es obligatorio." }, { status: 400 });
    }

    const currentCountResult = (await db`
      SELECT COUNT(*)::int AS total
      FROM stylehub_business_branches
      WHERE business_user_id = ${auth.userId}
    `) as Array<{ total: number }>;

    if ((currentCountResult[0]?.total ?? 0) >= 3) {
      return NextResponse.json({ error: "Solo puedes registrar hasta 3 sucursales." }, { status: 400 });
    }

    const description = payload.description?.trim() || null;
    const address = payload.address?.trim() || null;
    const city = payload.city?.trim() || null;
    const state = payload.state?.trim() || null;
    const postalCode = payload.postalCode?.trim() || null;
    const latitude = parseCoordinate(payload.latitude);
    const longitude = parseCoordinate(payload.longitude);

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: "Las coordenadas deben ser números válidos." }, { status: 400 });
    }

    if (latitude !== null && (latitude < -90 || latitude > 90)) {
      return NextResponse.json({ error: "La latitud debe estar entre -90 y 90." }, { status: 400 });
    }

    if (longitude !== null && (longitude < -180 || longitude > 180)) {
      return NextResponse.json({ error: "La longitud debe estar entre -180 y 180." }, { status: 400 });
    }

    const phone = payload.phone?.trim() || null;
    const website = payload.website?.trim() || null;
    const imageFromUpload = payload.branchImageFile ? await saveBranchImage(payload.branchImageFile) : null;
    const imageUrl = imageFromUpload ?? (payload.imageUrl?.trim() || null);
    const proofFromUpload = payload.ownershipProofFile ? await saveBranchOwnershipProof(payload.ownershipProofFile) : null;
    const ownershipProofUrl = proofFromUpload ?? (payload.ownershipProofUrl?.trim() || null);
    const openingHours = payload.openingHours?.trim() || null;
    const closingHours = payload.closingHours?.trim() || null;
    const isPrimary = Boolean(payload.isPrimary ?? false);

    if (!ownershipProofUrl) {
      return NextResponse.json(
        { error: "Debes adjuntar un comprobante de propiedad para enviar la sucursal a validación." },
        { status: 400 },
      );
    }

    if (isPrimary) {
      await db`
        UPDATE stylehub_business_branches
        SET is_primary = FALSE,
            updated_at = NOW()
        WHERE business_user_id = ${auth.userId}
      `;
    }

    const [branch] = (await db`
      INSERT INTO stylehub_business_branches (
        business_user_id,
        branch_name,
        description,
        address,
        city,
        state,
        postal_code,
        latitude,
        longitude,
        phone,
        website,
        image_url,
        ownership_proof_url,
        validation_status,
        validation_notes,
        verified_at,
        verified_by,
        opening_hours,
        closing_hours,
        is_primary,
        updated_at
      )
      VALUES (
        ${auth.userId},
        ${branchName},
        ${description},
        ${address},
        ${city},
        ${state},
        ${postalCode},
        ${latitude},
        ${longitude},
        ${phone},
        ${website},
        ${imageUrl},
        ${ownershipProofUrl},
        'pending',
        NULL,
        NULL,
        NULL,
        ${openingHours},
        ${closingHours},
        ${isPrimary},
        NOW()
      )
      RETURNING id, branch_name, description, address, city, state, postal_code, latitude, longitude, phone, website, image_url, ownership_proof_url, validation_status, validation_notes, verified_at, opening_hours, closing_hours, is_primary, created_at
    `) as Array<{
      id: string;
      branch_name: string;
      description: string | null;
      address: string | null;
      city: string | null;
      state: string | null;
      postal_code: string | null;
      latitude: string | null;
      longitude: string | null;
      phone: string | null;
      website: string | null;
      image_url: string | null;
      ownership_proof_url: string | null;
      validation_status: "pending" | "approved" | "rejected";
      validation_notes: string | null;
      verified_at: string | null;
      opening_hours: string | null;
      closing_hours: string | null;
      is_primary: boolean;
      created_at: string;
    }>;

    return NextResponse.json({ branch }, { status: 201 });
  } catch (error) {
    console.error(error);

    const errorWithCode = error as { code?: string };
    if (errorWithCode.code === "22003") {
      return NextResponse.json({ error: "Coordenadas fuera de rango. Revisa latitud y longitud." }, { status: 400 });
    }

    return NextResponse.json({ error: "No se pudo crear la sucursal." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await getCurrentBusinessUser();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    await ensureStylehubSchema();
    const db = getDb();
    const payload = await readPayload(request);

    const id = payload.id?.trim();
    const branchName = payload.branchName?.trim();
    if (!id || !branchName) {
      return NextResponse.json({ error: "Sucursal inválida." }, { status: 400 });
    }

    const description = payload.description?.trim() || null;
    const address = payload.address?.trim() || null;
    const city = payload.city?.trim() || null;
    const state = payload.state?.trim() || null;
    const postalCode = payload.postalCode?.trim() || null;
    const latitude = parseCoordinate(payload.latitude);
    const longitude = parseCoordinate(payload.longitude);

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: "Las coordenadas deben ser números válidos." }, { status: 400 });
    }

    if (latitude !== null && (latitude < -90 || latitude > 90)) {
      return NextResponse.json({ error: "La latitud debe estar entre -90 y 90." }, { status: 400 });
    }

    if (longitude !== null && (longitude < -180 || longitude > 180)) {
      return NextResponse.json({ error: "La longitud debe estar entre -180 y 180." }, { status: 400 });
    }

    const phone = payload.phone?.trim() || null;
    const website = payload.website?.trim() || null;
    const imageFromUpload = payload.branchImageFile ? await saveBranchImage(payload.branchImageFile) : null;
    const imageUrl = imageFromUpload ?? (payload.imageUrl?.trim() || null);
    const proofFromUpload = payload.ownershipProofFile ? await saveBranchOwnershipProof(payload.ownershipProofFile) : null;
    const ownershipProofUrl = proofFromUpload ?? (payload.ownershipProofUrl?.trim() || null);
    const openingHours = payload.openingHours?.trim() || null;
    const closingHours = payload.closingHours?.trim() || null;
    const isPrimary = Boolean(payload.isPrimary ?? false);

    if (!ownershipProofUrl) {
      return NextResponse.json(
        { error: "Debes adjuntar un comprobante de propiedad para validar la sucursal." },
        { status: 400 },
      );
    }

    if (isPrimary) {
      await db`
        UPDATE stylehub_business_branches
        SET is_primary = FALSE,
            updated_at = NOW()
        WHERE business_user_id = ${auth.userId}
      `;
    }

    const updated = (await db`
      UPDATE stylehub_business_branches
      SET branch_name = ${branchName},
          description = ${description},
          address = ${address},
          city = ${city},
          state = ${state},
          postal_code = ${postalCode},
          latitude = ${latitude},
          longitude = ${longitude},
          phone = ${phone},
          website = ${website},
          image_url = ${imageUrl},
          ownership_proof_url = ${ownershipProofUrl},
          validation_status = 'pending',
          validation_notes = NULL,
          verified_at = NULL,
          verified_by = NULL,
          opening_hours = ${openingHours},
          closing_hours = ${closingHours},
          is_primary = ${isPrimary},
          updated_at = NOW()
      WHERE id = ${id}
      AND business_user_id = ${auth.userId}
      RETURNING id
    `) as Array<{ id: string }>;

    if (updated.length === 0) {
      return NextResponse.json({ error: "No se encontró la sucursal." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);

    const errorWithCode = error as { code?: string };
    if (errorWithCode.code === "22003") {
      return NextResponse.json({ error: "Coordenadas fuera de rango. Revisa latitud y longitud." }, { status: 400 });
    }

    return NextResponse.json({ error: "No se pudo actualizar la sucursal." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await getCurrentBusinessUser();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    await ensureStylehubSchema();
    const db = getDb();
    const payload = (await request.json()) as { id?: string };
    const id = payload.id?.trim();

    if (!id) {
      return NextResponse.json({ error: "Sucursal inválida." }, { status: 400 });
    }

    const deleted = (await db`
      DELETE FROM stylehub_business_branches
      WHERE id = ${id}
      AND business_user_id = ${auth.userId}
      RETURNING id
    `) as Array<{ id: string }>;

    if (deleted.length === 0) {
      return NextResponse.json({ error: "No se encontró la sucursal." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo eliminar la sucursal." }, { status: 500 });
  }
}
