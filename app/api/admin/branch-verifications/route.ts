import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";

export const runtime = "nodejs";

type ValidationStatus = "pending" | "approved" | "rejected";

function isValidationStatus(value: unknown): value is ValidationStatus {
  return value === "pending" || value === "approved" || value === "rejected";
}

export async function GET(request: Request) {
  try {
    await ensureStylehubSchema();
    const db = getDb();

    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status");
    const statusFilter = isValidationStatus(statusParam) ? statusParam : null;

    const branches = statusFilter
      ? await db`
          SELECT
            br.id,
            br.branch_name,
            br.city,
            br.state,
            br.address,
            br.image_url,
            br.ownership_proof_url,
            br.validation_status,
            br.validation_notes,
            br.created_at,
            br.verified_at,
            u.id AS business_user_id,
            u.business_name,
            u.first_name,
            u.last_name,
            u.email
          FROM stylehub_business_branches br
          JOIN stylehub_users u ON u.id = br.business_user_id
          WHERE br.validation_status = ${statusFilter}
          ORDER BY br.created_at DESC
        `
      : await db`
          SELECT
            br.id,
            br.branch_name,
            br.city,
            br.state,
            br.address,
            br.image_url,
            br.ownership_proof_url,
            br.validation_status,
            br.validation_notes,
            br.created_at,
            br.verified_at,
            u.id AS business_user_id,
            u.business_name,
            u.first_name,
            u.last_name,
            u.email
          FROM stylehub_business_branches br
          JOIN stylehub_users u ON u.id = br.business_user_id
          ORDER BY br.created_at DESC
        `;

    return NextResponse.json({ branches });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudieron cargar las sucursales para verificación." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureStylehubSchema();
    const db = getDb();

    const payload = (await request.json()) as {
      branchId?: string;
      status?: ValidationStatus;
      notes?: string;
      reviewer?: string;
    };

    const branchId = payload.branchId?.trim();
    const status = payload.status;
    const notes = payload.notes?.trim() || null;
    const reviewer = payload.reviewer?.trim() || "admin";

    if (!branchId || !status || !isValidationStatus(status)) {
      return NextResponse.json({ error: "Datos de validación inválidos." }, { status: 400 });
    }

    const updated = (await db`
      UPDATE stylehub_business_branches
      SET validation_status = ${status},
          validation_notes = ${notes},
          verified_at = NOW(),
          verified_by = ${reviewer},
          updated_at = NOW()
      WHERE id = ${branchId}
      RETURNING id
    `) as Array<{ id: string }>;

    if (updated.length === 0) {
      return NextResponse.json({ error: "No se encontró la sucursal." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo actualizar la validación." }, { status: 500 });
  }
}
