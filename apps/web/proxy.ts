import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Clerk en cada petición (para que auth() funcione en páginas y rutas de API). Las secciones privadas mandan a
 * iniciar sesión si no hay sesión de Clerk. Es solo una revisión rápida: cada layout y cada ruta de datos
 * verifica de nuevo la cuenta y sus permisos en nuestra base (lib/sesion.ts).
 */
const esPrivada = createRouteMatcher(["/dashboard(.*)", "/registro(.*)", "/entrar"]);

export default clerkMiddleware(async (auth, req) => {
  if (!esPrivada(req)) return;
  const { userId } = await auth();
  // A nuestra página de inicio de sesión (no al portal de Clerk). Después de entrar, Clerk lleva a /entrar.
  if (!userId) return NextResponse.redirect(new URL("/iniciar-sesion", req.url));
});

export const config = {
  matcher: [
    // Todo menos archivos internos de Next y estáticos
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
