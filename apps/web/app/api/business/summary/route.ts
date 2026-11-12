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

    const [servicesCountResult] = (await db`
      SELECT COUNT(*)::int AS total
      FROM stylehub_business_services
      WHERE business_user_id = ${auth.userId}
    `) as Array<{ total: number }>;

    const [stylistsCountResult] = (await db`
      SELECT COUNT(*)::int AS total
      FROM stylehub_business_stylists
      WHERE business_user_id = ${auth.userId}
    `) as Array<{ total: number }>;

    const [appointmentsCountResult] = (await db`
      SELECT COUNT(*)::int AS total
      FROM stylehub_client_appointments
      WHERE business_user_id = ${auth.userId}
      AND status IN ('pending', 'confirmed')
      AND scheduled_at >= NOW()
    `) as Array<{ total: number }>;

    const [monthlyRevenueResult] = (await db`
      SELECT COALESCE(SUM(total_amount), 0)::numeric AS total
      FROM stylehub_client_appointments
      WHERE business_user_id = ${auth.userId}
      AND status = 'completed'
      AND DATE_TRUNC('month', scheduled_at) = DATE_TRUNC('month', NOW())
    `) as Array<{ total: string }>;

    const [clientsCountResult] = (await db`
      SELECT COUNT(DISTINCT client_user_id)::int AS total
      FROM stylehub_client_appointments
      WHERE business_user_id = ${auth.userId}
    `) as Array<{ total: number }>;

    const [branchesCountResult] = (await db`
      SELECT COUNT(*)::int AS total
      FROM stylehub_business_branches
      WHERE business_user_id = ${auth.userId}
    `) as Array<{ total: number }>;

    return NextResponse.json({
      summary: {
        services: servicesCountResult?.total ?? 0,
        stylists: stylistsCountResult?.total ?? 0,
        upcomingAppointments: appointmentsCountResult?.total ?? 0,
        monthlyRevenue: Number(monthlyRevenueResult?.total ?? 0),
        clients: clientsCountResult?.total ?? 0,
        branches: branchesCountResult?.total ?? 0,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo cargar el resumen." }, { status: 500 });
  }
}
