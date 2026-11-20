/**
 * Cabeceras de seguridad de todas las páginas (next.config.ts → headers()).
 *
 * Se aplican de verdad: HSTS, no incrustar el sitio en otra página (clickjacking), nosniff, Referrer-Policy y
 * Permissions-Policy. La política de contenido completa (CSP) va primero en modo de solo reporte: el navegador
 * avisa en la consola qué bloquearía, sin romper Clerk ni Stripe. Cuando no haya avisos, se pasa a
 * Content-Security-Policy.
 */
export function politicaDeContenido(urlBackend: string) {
  const backend = new URL(urlBackend).origin;
  const clerk = "https://clerk.stylehub.synovasystems.com https://*.clerk.accounts.dev";
  return [
    "default-src 'self'",
    // Next mete scripts en línea (sin nonce); Clerk y Stripe cargan los suyos
    `script-src 'self' 'unsafe-inline' ${clerk} https://js.stripe.com https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://images.unsplash.com https://img.clerk.com " + backend,
    "font-src 'self' data:",
    `connect-src 'self' ${backend} ${clerk} https://api.stripe.com`,
    "frame-src https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function cabecerasDeSeguridad(urlBackend: string) {
  return [
    { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
    { key: "X-Frame-Options", value: "DENY" },
    // frame-ancestors sí se aplica (es lo mismo que X-Frame-Options, en su versión moderna)
    { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
    { key: "Content-Security-Policy-Report-Only", value: politicaDeContenido(urlBackend) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // La ubicación la usa el buscador de salones; el pago, el formulario de Stripe
    { key: "Permissions-Policy", value: 'camera=(), microphone=(), geolocation=(self), payment=(self "https://js.stripe.com")' },
  ];
}
