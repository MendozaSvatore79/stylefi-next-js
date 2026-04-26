import { NextResponse, connection } from "next/server";

import { getLiveDashboardPayload } from "@/lib/live-dashboard";

export const runtime = "nodejs";

export async function GET() {
  try {
    await connection();

    const dashboard = await getLiveDashboardPayload();
    return NextResponse.json(dashboard);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo cargar el live dashboard." }, { status: 500 });
  }
}
