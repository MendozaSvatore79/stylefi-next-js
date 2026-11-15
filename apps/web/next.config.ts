import type { NextConfig } from "next";

// Fase 4: el front ya no tiene rutas de datos ni lee la base; todo va al backend. Sin NEXT_PUBLIC_API_URL no
// funcionaría nada, así que no se compila ni se arranca (mejor un error claro en el despliegue que una app rota).
if (!process.env.NEXT_PUBLIC_API_URL?.trim()) {
  throw new Error("Falta NEXT_PUBLIC_API_URL (la URL del backend, por ejemplo https://api.tudominio.com).");
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
