/**
 * Cabeceras de seguridad de todas las páginas (next.config.ts → headers()).
 *
 * HSTS, no incrustar el sitio en otra página (clickjacking), nosniff, Referrer-Policy, Permissions-Policy y la
 * política de contenido (CSP). La CSP estuvo en solo reporte hasta revisarla en Chrome (2026-11-19): sin sesión y
 * en las 11 pantallas de cliente y negocio, el único aviso era Clerk Protect, ya permitido.
 */
export function politicaDeContenido(urlBackend: string, origenSentry: string | null = null) {
  const backend = new URL(urlBackend).origin;
  // Errores del navegador (lib/sentry-navegador.ts), solo si hay DSN
  const sentry = origenSentry ? ` ${origenSentry}` : "";
  const clerk = "https://clerk.stylehub.synovasystems.com https://*.clerk.accounts.dev";
  // Clerk Protect (protección contra bots): su script y sondeos a *.client.protect.clerk.com en varios puertos
  const clerkProtect = { script: "https://cdn.protect.clerk.com", conexion: "https://*.protect.clerk.com:*" };
  return [
    "default-src 'self'",
    // Next mete scripts en línea (sin nonce); Clerk y Stripe cargan los suyos
    `script-src 'self' 'unsafe-inline' ${clerk} ${clerkProtect.script} https://js.stripe.com https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://img.clerk.com " + backend,
    "font-src 'self' data:",
    `connect-src 'self' ${backend} ${clerk} ${clerkProtect.conexion} https://api.stripe.com${sentry}`,
    // www.google.com: el mapa de la sucursal en el modal del salón (iframe de Google Maps); sin esto salía bloqueado
    "frame-src https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com https://www.google.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function cabecerasDeSeguridad(urlBackend: string, origenSentry: string | null = null) {
  return [
    { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Content-Security-Policy", value: politicaDeContenido(urlBackend, origenSentry) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // La ubicación la usa el buscador de salones; el pago, el formulario de Stripe
    { key: "Permissions-Policy", value: 'camera=(), microphone=(), geolocation=(self), payment=(self "https://js.stripe.com")' },
  ];
}

/** Caché de las fotos y logos estáticos (public/estilos y public/brand): una semana. */
export const CACHE_DE_IMAGENES = "public, max-age=604800, stale-while-revalidate=86400";
