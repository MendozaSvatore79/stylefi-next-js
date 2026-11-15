import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

import { errorEnUrlDelBackend } from "./lib/url-backend";

// Fase 4: el front ya no tiene rutas de datos ni lee la base; todo va al backend. Sin una NEXT_PUBLIC_API_URL
// completa (con http:// o https://) no funcionaría nada, así que no se compila ni se arranca (mejor un error claro
// en el despliegue que una app rota).
const errorUrl = errorEnUrlDelBackend(process.env.NEXT_PUBLIC_API_URL);
if (errorUrl) throw new Error(errorUrl);

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: workspaceRoot,
};

export default nextConfig;
