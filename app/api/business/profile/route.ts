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

    const profileResult = (await db`
      SELECT
        u.id,
        u.business_name,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        b.salon_name,
        b.description,
        b.address,
        b.city,
        b.state,
        b.postal_code,
        b.latitude,
        b.longitude,
        b.website,
        b.image_url,
        b.opening_hours,
        b.closing_hours
      FROM stylehub_users u
      LEFT JOIN stylehub_business_info b ON b.business_user_id = u.id
      WHERE u.id = ${auth.userId}
      LIMIT 1
    `) as Array<{
      id: string;
      business_name: string | null;
      first_name: string | null;
      last_name: string | null;
      email: string;
      phone: string | null;
      salon_name: string | null;
      description: string | null;
      address: string | null;
      city: string | null;
      state: string | null;
      postal_code: string | null;
      latitude: string | null;
      longitude: string | null;
      website: string | null;
      image_url: string | null;
      opening_hours: string | null;
      closing_hours: string | null;
    }>;

    return NextResponse.json({ profile: profileResult[0] ?? null });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo cargar el perfil." }, { status: 500 });
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
      businessName?: string;
      phone?: string;
      salonName?: string;
      description?: string;
      address?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      latitude?: number | null;
      longitude?: number | null;
      website?: string;
      imageUrl?: string;
      openingHours?: string;
      closingHours?: string;
    };

    const businessName = payload.businessName?.trim() || null;
    const phone = payload.phone?.trim() || null;
    const salonName = payload.salonName?.trim() || businessName || "Mi Salón";
    const description = payload.description?.trim() || null;
    const address = payload.address?.trim() || null;
    const city = payload.city?.trim() || null;
    const state = payload.state?.trim() || null;
    const postalCode = payload.postalCode?.trim() || null;
    const latitude = payload.latitude ?? null;
    const longitude = payload.longitude ?? null;
    const website = payload.website?.trim() || null;
    const imageUrl = payload.imageUrl?.trim() || null;
    const openingHours = payload.openingHours?.trim() || null;
    const closingHours = payload.closingHours?.trim() || null;

    await db`
      UPDATE stylehub_users
      SET business_name = ${businessName},
          phone = ${phone},
          updated_at = NOW()
      WHERE id = ${auth.userId}
    `;

    await db`
      INSERT INTO stylehub_business_info (
        business_user_id,
        salon_name,
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
        opening_hours,
        closing_hours,
        updated_at
      )
      VALUES (
        ${auth.userId},
        ${salonName},
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
        ${openingHours},
        ${closingHours},
        NOW()
      )
      ON CONFLICT (business_user_id)
      DO UPDATE SET
        salon_name = EXCLUDED.salon_name,
        description = EXCLUDED.description,
        address = EXCLUDED.address,
        city = EXCLUDED.city,
        state = EXCLUDED.state,
        postal_code = EXCLUDED.postal_code,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        phone = EXCLUDED.phone,
        website = EXCLUDED.website,
        image_url = EXCLUDED.image_url,
        opening_hours = EXCLUDED.opening_hours,
        closing_hours = EXCLUDED.closing_hours,
        updated_at = NOW()
    `;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo guardar el perfil." }, { status: 500 });
  }
}
