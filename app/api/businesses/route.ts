import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authConfig } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ensureStylehubSchema } from "@/lib/db-init";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await ensureStylehubSchema();
    const db = getDb();

    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");

    // Si se solicita un negocio específico con detalles
    if (businessId) {
      const session = await getServerSession(authConfig);

      if (!session?.user) {
        return NextResponse.json(
          { error: "Debes iniciar sesión para ver más detalles del salón." },
          { status: 401 },
        );
      }

      const result = await db`
        SELECT
          u.id,
          u.business_name,
          u.first_name,
          u.last_name,
          br.branch_name AS salon_name,
          br.description,
          br.address,
          br.city,
          br.state,
          br.postal_code,
          br.latitude,
          br.longitude,
          COALESCE(br.phone, u.phone) AS phone,
          br.website,
          br.image_url,
          br.opening_hours,
          br.closing_hours,
          br.id AS branch_id
        FROM stylehub_users u
        LEFT JOIN LATERAL (
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
            opening_hours,
            closing_hours
          FROM stylehub_business_branches
          WHERE business_user_id = u.id
          AND validation_status = 'approved'
          ORDER BY is_primary DESC, created_at ASC
          LIMIT 1
        ) br ON true
        WHERE u.id = ${businessId}
        AND u.account_type = 'negocio'
        AND br.id IS NOT NULL
      `;

      const business = (result as Array<{ id: string } & Record<string, unknown>>)[0];

      if (!business) {
        return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
      }

      // Obtener todas las sucursales aprobadas del negocio (para mostrar múltiples ubicaciones)
      const branches = await db`
        SELECT id, branch_name, description, address, city, state, postal_code, latitude, longitude, phone, website, image_url, opening_hours, closing_hours, is_primary
        FROM stylehub_business_branches
        WHERE business_user_id = ${businessId}
        AND validation_status = 'approved'
        ORDER BY is_primary DESC, created_at ASC
      `;

      const services = await db`
        SELECT s.id, s.service_name, s.description, s.price, s.duration_minutes, s.image_url, s.branch_id
        FROM stylehub_business_services s
        JOIN stylehub_business_branches br ON br.id = s.branch_id
        WHERE s.business_user_id = ${businessId}
        AND br.validation_status = 'approved'
        ORDER BY s.created_at DESC
      `;

      const stylists = await db`
        SELECT st.id, st.first_name, st.last_name, st.email, st.specialization, st.years_experience, st.image_url, st.available, st.branch_id
        FROM stylehub_business_stylists st
        JOIN stylehub_business_branches br ON br.id = st.branch_id
        WHERE st.business_user_id = ${businessId}
        AND br.validation_status = 'approved'
        ORDER BY st.created_at DESC
      `;

      return NextResponse.json({ business, branches, services, stylists });
    }

    // Listar todos los negocios
    const businesses = await db`
      SELECT
        u.id,
        u.business_name,
        u.first_name,
        u.last_name,
        br.branch_name AS salon_name,
        br.description,
        br.address,
        br.city,
        br.state,
        br.image_url,
        br.service_summary
      FROM stylehub_users u
      JOIN LATERAL (
        SELECT
          branch_name,
          description,
          address,
          city,
          state,
          image_url,
          COALESCE((
            SELECT STRING_AGG(DISTINCT s.service_name, ', ' ORDER BY s.service_name)
            FROM stylehub_business_services s
            JOIN stylehub_business_branches sb ON sb.id = s.branch_id
            WHERE s.business_user_id = u.id
              AND sb.validation_status = 'approved'
          ), '') AS service_summary
        FROM stylehub_business_branches
        WHERE business_user_id = u.id
        AND validation_status = 'approved'
        ORDER BY is_primary DESC, created_at ASC
        LIMIT 1
      ) br ON true
      WHERE u.account_type = 'negocio'
      ORDER BY u.created_at DESC
      LIMIT 100
    `;

    return NextResponse.json({ businesses });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudieron cargar los negocios." }, { status: 500 });
  }
}
