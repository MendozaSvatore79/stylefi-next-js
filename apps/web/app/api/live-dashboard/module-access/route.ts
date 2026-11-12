import { NextResponse, connection } from "next/server";

import { getModuleAccessByPath } from "@/lib/live-dashboard";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await connection();

    const url = new URL(request.url);
    const pathname = url.searchParams.get("pathname")?.trim();

    if (!pathname || !pathname.startsWith("/")) {
      return NextResponse.json({ error: "Pathname inválido." }, { status: 400 });
    }

    const access = await getModuleAccessByPath(pathname);
    return NextResponse.json(access);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo evaluar el acceso del módulo." }, { status: 500 });
  }
}
