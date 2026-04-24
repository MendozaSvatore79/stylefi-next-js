import { NextResponse } from "next/server";

import { getCurrentClientUser } from "@/app/api/client/_current-user";
import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";

export const runtime = "nodejs";

export async function GET() {
  const auth = await getCurrentClientUser();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    await ensureStylehubSchema();
    const db = getDb();

    const favorites = await db`
      SELECT
        f.business_user_id,
        u.business_name,
        u.first_name,
        u.last_name,
        br.branch_name AS salon_name,
        br.description,
        br.address,
        br.city,
        br.state,
        br.image_url,
        f.created_at
      FROM stylehub_client_favorite_businesses f
      JOIN stylehub_users u ON u.id = f.business_user_id
      LEFT JOIN LATERAL (
        SELECT
          branch_name,
          description,
          address,
          city,
          state,
          image_url
        FROM stylehub_business_branches
        WHERE business_user_id = u.id
        AND validation_status = 'approved'
        ORDER BY is_primary DESC, created_at ASC
        LIMIT 1
      ) br ON true
      WHERE f.user_id = ${auth.userId}
      ORDER BY f.created_at DESC
    `;

    return NextResponse.json({ favorites });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudieron cargar los favoritos." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await getCurrentClientUser();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    await ensureStylehubSchema();
    const db = getDb();
    const payload = (await request.json()) as { businessUserId?: string };

    const businessUserId = payload.businessUserId?.trim();

    if (!businessUserId) {
      return NextResponse.json({ error: "Negocio inválido." }, { status: 400 });
    }

    const businesses = (await db`
      SELECT id
      FROM stylehub_users
      WHERE id = ${businessUserId}
      AND account_type = 'negocio'
      LIMIT 1
    `) as Array<{ id: string }>;

    if (businesses.length === 0) {
      return NextResponse.json({ error: "Negocio no válido." }, { status: 400 });
    }

    await db`
      INSERT INTO stylehub_client_favorite_businesses (user_id, business_user_id)
      VALUES (${auth.userId}, ${businessUserId})
      ON CONFLICT (user_id, business_user_id) DO NOTHING
    `;

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo guardar favorito." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await getCurrentClientUser();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    await ensureStylehubSchema();
    const db = getDb();
    const payload = (await request.json()) as { businessUserId?: string };

    const businessUserId = payload.businessUserId?.trim();

    if (!businessUserId) {
      return NextResponse.json({ error: "Negocio inválido." }, { status: 400 });
    }

    await db`
      DELETE FROM stylehub_client_favorite_businesses
      WHERE user_id = ${auth.userId}
      AND business_user_id = ${businessUserId}
    `;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo eliminar favorito." }, { status: 500 });
  }
}
