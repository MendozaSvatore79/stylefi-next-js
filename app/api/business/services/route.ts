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

    const services = await db`
      SELECT
        s.id,
        s.service_name,
        s.description,
        s.price,
        s.duration_minutes,
        s.image_url,
        s.branch_id,
        b.branch_name,
        s.created_at
      FROM stylehub_business_services s
      LEFT JOIN stylehub_business_branches b ON b.id = s.branch_id
      WHERE s.business_user_id = ${auth.userId}
      ORDER BY s.created_at DESC
    `;

    return NextResponse.json({ services });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudieron cargar los servicios." }, { status: 500 });
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
      serviceName?: string;
      description?: string;
      price?: number;
      durationMinutes?: number;
      imageUrl?: string;
      branchId?: string;
    };

    const serviceName = payload.serviceName?.trim();
    const description = payload.description?.trim() || null;
    const price = Number(payload.price ?? 0);
    const durationMinutes = Number(payload.durationMinutes ?? 0) || null;
    const imageUrl = payload.imageUrl?.trim() || null;
    const branchId = payload.branchId?.trim();

    if (!serviceName) {
      return NextResponse.json({ error: "El nombre del servicio es obligatorio." }, { status: 400 });
    }

    if (price <= 0) {
      return NextResponse.json({ error: "El precio debe ser mayor a 0." }, { status: 400 });
    }

    if (!branchId) {
      return NextResponse.json({ error: "Debes seleccionar una sucursal para el servicio." }, { status: 400 });
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

    const [service] = (await db`
      INSERT INTO stylehub_business_services (
        business_user_id,
        branch_id,
        service_name,
        description,
        price,
        duration_minutes,
        image_url,
        updated_at
      )
      VALUES (
        ${auth.userId},
        ${branchId},
        ${serviceName},
        ${description},
        ${price},
        ${durationMinutes},
        ${imageUrl},
        NOW()
      )
      RETURNING id, service_name, description, price, duration_minutes, image_url, branch_id, created_at
    `) as Array<{
      id: string;
      service_name: string;
      description: string | null;
      price: string;
      duration_minutes: number | null;
      image_url: string | null;
      branch_id: string | null;
      created_at: string;
    }>;

    return NextResponse.json({ service }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo crear el servicio." }, { status: 500 });
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
      serviceName?: string;
      description?: string;
      price?: number;
      durationMinutes?: number;
      imageUrl?: string;
      branchId?: string;
    };

    const id = payload.id?.trim();
    const serviceName = payload.serviceName?.trim();
    const description = payload.description?.trim() || null;
    const price = Number(payload.price ?? 0);
    const durationMinutes = Number(payload.durationMinutes ?? 0) || null;
    const imageUrl = payload.imageUrl?.trim() || null;
    const branchId = payload.branchId?.trim();

    if (!id || !serviceName) {
      return NextResponse.json({ error: "Servicio inválido." }, { status: 400 });
    }

    if (price <= 0) {
      return NextResponse.json({ error: "El precio debe ser mayor a 0." }, { status: 400 });
    }

    if (!branchId) {
      return NextResponse.json({ error: "Debes seleccionar una sucursal para el servicio." }, { status: 400 });
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
      UPDATE stylehub_business_services
      SET service_name = ${serviceName},
          branch_id = ${branchId},
          description = ${description},
          price = ${price},
          duration_minutes = ${durationMinutes},
          image_url = ${imageUrl},
          updated_at = NOW()
      WHERE id = ${id}
      AND business_user_id = ${auth.userId}
      RETURNING id
    `) as Array<{ id: string }>;

    if (updated.length === 0) {
      return NextResponse.json({ error: "No se encontró el servicio." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo actualizar el servicio." }, { status: 500 });
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
      return NextResponse.json({ error: "Servicio inválido." }, { status: 400 });
    }

    const deleted = (await db`
      DELETE FROM stylehub_business_services
      WHERE id = ${id}
      AND business_user_id = ${auth.userId}
      RETURNING id
    `) as Array<{ id: string }>;

    if (deleted.length === 0) {
      return NextResponse.json({ error: "No se encontró el servicio." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo eliminar el servicio." }, { status: 500 });
  }
}
