import { NextResponse } from "next/server";

import { getCurrentBusinessUser } from "@/app/api/business/_current-user";
import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";

export const runtime = "nodejs";

export async function GET() {
  const auth = await getCurrentBusinessUser();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    await ensureStylehubSchema();
    const db = getDb();

    const stylists = await db`
      SELECT
        s.id,
        s.first_name,
        s.last_name,
        s.email,
        s.phone,
        s.specialization,
        s.years_experience,
        s.image_url,
        s.available,
        s.branch_id,
        b.branch_name,
        s.created_at
      FROM stylehub_business_stylists s
      LEFT JOIN stylehub_business_branches b ON b.id = s.branch_id
      WHERE s.business_user_id = ${auth.userId}
      ORDER BY s.created_at DESC
    `;

    return NextResponse.json({ stylists });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudieron cargar los estilistas." }, { status: 500 });
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
    const payload = (await request.json()) as {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      specialization?: string;
      yearsExperience?: number;
      imageUrl?: string;
      available?: boolean;
      branchId?: string;
    };

    const firstName = payload.firstName?.trim();
    const lastName = payload.lastName?.trim();
    const email = payload.email?.trim() || null;
    const phone = payload.phone?.trim() || null;
    const specialization = payload.specialization?.trim() || null;
    const yearsExperience = Number(payload.yearsExperience ?? 0) || null;
    const imageUrl = payload.imageUrl?.trim() || null;
    const available = Boolean(payload.available ?? true);
    const branchId = payload.branchId?.trim();

    if (!firstName || !lastName) {
      return NextResponse.json({ error: "Nombre y apellido son obligatorios." }, { status: 400 });
    }

    if (!branchId) {
      return NextResponse.json({ error: "Debes seleccionar una sucursal para el estilista." }, { status: 400 });
    }

    const branch = (await db`
      SELECT id
      FROM stylehub_business_branches
      WHERE id = ${branchId}
      AND business_user_id = ${auth.userId}
      LIMIT 1
    `) as Array<{ id: string }>;

    if (branch.length === 0) {
      return NextResponse.json({ error: "La sucursal seleccionada no es válida." }, { status: 400 });
    }

    const [stylist] = (await db`
      INSERT INTO stylehub_business_stylists (
        business_user_id,
        branch_id,
        first_name,
        last_name,
        email,
        phone,
        specialization,
        years_experience,
        image_url,
        available,
        updated_at
      )
      VALUES (
        ${auth.userId},
        ${branchId},
        ${firstName},
        ${lastName},
        ${email},
        ${phone},
        ${specialization},
        ${yearsExperience},
        ${imageUrl},
        ${available},
        NOW()
      )
      RETURNING id, first_name, last_name, email, phone, specialization, years_experience, image_url, available, branch_id, created_at
    `) as Array<{
      id: string;
      first_name: string;
      last_name: string;
      email: string | null;
      phone: string | null;
      specialization: string | null;
      years_experience: number | null;
      image_url: string | null;
      available: boolean;
      branch_id: string | null;
      created_at: string;
    }>;

    return NextResponse.json({ stylist }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo crear el estilista." }, { status: 500 });
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
    const payload = (await request.json()) as {
      id?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      specialization?: string;
      yearsExperience?: number;
      imageUrl?: string;
      available?: boolean;
      branchId?: string;
    };

    const id = payload.id?.trim();
    const firstName = payload.firstName?.trim();
    const lastName = payload.lastName?.trim();
    const email = payload.email?.trim() || null;
    const phone = payload.phone?.trim() || null;
    const specialization = payload.specialization?.trim() || null;
    const yearsExperience = Number(payload.yearsExperience ?? 0) || null;
    const imageUrl = payload.imageUrl?.trim() || null;
    const available = Boolean(payload.available ?? true);
    const branchId = payload.branchId?.trim();

    if (!id || !firstName || !lastName) {
      return NextResponse.json({ error: "Datos del estilista inválidos." }, { status: 400 });
    }

    if (!branchId) {
      return NextResponse.json({ error: "Debes seleccionar una sucursal para el estilista." }, { status: 400 });
    }

    const branch = (await db`
      SELECT id
      FROM stylehub_business_branches
      WHERE id = ${branchId}
      AND business_user_id = ${auth.userId}
      LIMIT 1
    `) as Array<{ id: string }>;

    if (branch.length === 0) {
      return NextResponse.json({ error: "La sucursal seleccionada no es válida." }, { status: 400 });
    }

    const updated = (await db`
      UPDATE stylehub_business_stylists
      SET first_name = ${firstName},
          last_name = ${lastName},
          branch_id = ${branchId},
          email = ${email},
          phone = ${phone},
          specialization = ${specialization},
          years_experience = ${yearsExperience},
          image_url = ${imageUrl},
          available = ${available},
          updated_at = NOW()
      WHERE id = ${id}
      AND business_user_id = ${auth.userId}
      RETURNING id
    `) as Array<{ id: string }>;

    if (updated.length === 0) {
      return NextResponse.json({ error: "No se encontró el estilista." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo actualizar el estilista." }, { status: 500 });
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
      return NextResponse.json({ error: "Estilista inválido." }, { status: 400 });
    }

    const deleted = (await db`
      DELETE FROM stylehub_business_stylists
      WHERE id = ${id}
      AND business_user_id = ${auth.userId}
      RETURNING id
    `) as Array<{ id: string }>;

    if (deleted.length === 0) {
      return NextResponse.json({ error: "No se encontró el estilista." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo eliminar el estilista." }, { status: 500 });
  }
}
