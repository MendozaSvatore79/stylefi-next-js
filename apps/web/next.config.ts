import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

import { CACHE_DE_IMAGENES, cabecerasDeSeguridad } from "./lib/cabeceras";
import { dsnDeSentry, origenDeSentry } from "./lib/sentry-navegador";
import { errorEnUrlDelBackend } from "./lib/url-backend";

// Fase 4: el front ya no tiene rutas de datos ni lee la base; todo va al backend. Sin una NEXT_PUBLIC_API_URL
// completa (con http:// o https://) no funcionaría nada, así que no se compila ni se arranca (mejor un error claro
// en el despliegue que una app rota).
const errorUrl = errorEnUrlDelBackend(process.env.NEXT_PUBLIC_API_URL);
if (errorUrl) throw new Error(errorUrl);

const origenSentry = origenDeSentry(dsnDeSentry(process.env));

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: workspaceRoot,
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: cabecerasDeSeguridad(process.env.NEXT_PUBLIC_API_URL!, origenSentry) },
      // Fotos y logos de public/: cambian casi nunca. Una semana en caché (si se reemplaza una, mejor con otro nombre).
      ...["/estilos/:path*", "/brand/:path*"].map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: CACHE_DE_IMAGENES }],
      })),
    ];
  },
};

export default nextConfig;
