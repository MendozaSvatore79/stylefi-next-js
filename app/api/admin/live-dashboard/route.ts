import { NextResponse } from "next/server";

import { getLiveDashboardPayload, updateLiveDashboardModule } from "@/lib/live-dashboard";

export const runtime = "nodejs";

type UpdatePayload = {
  moduleKey?: string;
  isEnabled?: boolean;
  isMaintenance?: boolean;
};

export async function GET() {
  try {
    const dashboard = await getLiveDashboardPayload({ includeDisabled: true });
    return NextResponse.json(dashboard);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo cargar la configuración del live dashboard." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as UpdatePayload;
    const moduleKey = payload.moduleKey?.trim();

    if (!moduleKey || (typeof payload.isEnabled !== "boolean" && typeof payload.isMaintenance !== "boolean")) {
      return NextResponse.json({ error: "Datos inválidos para actualizar el módulo." }, { status: 400 });
    }

    const updated = await updateLiveDashboardModule(moduleKey, {
      isEnabled: payload.isEnabled,
      isMaintenance: payload.isMaintenance,
    });

    if (!updated) {
      return NextResponse.json({ error: "No se encontró el módulo solicitado." }, { status: 404 });
    }

    const dashboard = await getLiveDashboardPayload({ includeDisabled: true });
    return NextResponse.json(dashboard);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo actualizar el módulo del dashboard." }, { status: 500 });
  }
}
