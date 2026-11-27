# StyleFi (front): guía para Claude Code

Reservas para salones de belleza. Este repo es el front. El API vive en el repo aparte `synova-backend`
(NestJS); el front no lee la base, todo pasa por el API.

## Monorepo
- `apps/web` (`@stylefi/web`): Next.js 16 (App Router), React 19, TypeScript, Tailwind. Es la app.
- `packages/shared` (`@stylefi/shared`): tipos y reglas compartidas (estados de cita, disponibilidad).
  Se consume desde `dist/`: correr `npm run build -w @stylefi/shared` antes de probar o compilar si cambió.
- `apps/web/CLAUDE.md` → `AGENTS.md`: **Next 16 trae cambios que rompen**. Antes de usar una API de Next,
  leer la guía en `node_modules/next/dist/docs/`. No fiarse de lo que se recuerda de versiones anteriores.
- El código del App Router está en `apps/web/app/` (no hay `src/`). Utilidades en `apps/web/lib/`,
  componentes en `apps/web/components/`, pruebas en `apps/web/tests/`. Alias `@/` = `apps/web/`.

## Despliegue
- AWS Amplify (`amplify.yml`, `appRoot: apps/web`) construye y publica al unir a `main`.
  **Unir a `main` es ir a producción: pedir permiso cada vez.** Sin push, PR ni merge sin permiso.
- CI (`.github/workflows/ci.yml`) en cada PR: build de shared, `npm run lint`, `npm test`, build.

## Rutas y roles
- Públicas (sin sesión): `/`, `/terms-of-service`, `/privacy-policy`, `robots`, `sitemap`, páginas de error.
- Con sesión, todas bajo `app/(con-sesion)/`:
  - `/dashboard/cliente`, `/dashboard/negocio` y `/dashboard/admin`, un panel por tipo de cuenta;
  - `/entrar`, `/iniciar-sesion`, `/register`, `/registro` y `/cuenta-suspendida`.
- El tipo de cuenta (`cliente | negocio | admin`) y el baneo los decide el backend, no Clerk.
  Cada `layout.tsx` de panel llama a `accesoAlPanel(tipo)` (`lib/sesion.ts`) y redirige si no corresponde.
  Ver `app/(con-sesion)/dashboard/CLAUDE.md`.

## Clerk y rendimiento (regla crítica)
- **Clerk no debe ser alcanzable desde una página pública.** `@clerk/*` solo se importa en `app/(con-sesion)/`
  o en módulos que solo se usan desde ahí (`lib/sesion*.ts(x)`, `lib/api-servidor.ts`, `components/marco-acceso.tsx`…).
  El `ClerkProvider` vive solo en `app/(con-sesion)/layout.tsx`. Así la portada bajó
  de 896 a 285 KB y el LCP de 6.3 s a 2.4 s.
- Lo vigila `apps/web/tests/clerk-fuera-de-portada.test.ts`, que recorre los imports desde cada página
  pública. Si falla, mover el código con Clerk al grupo `(con-sesion)`. No relajar la prueba.
- `apps/web/proxy.ts` (el middleware de Next 16):
  - `clerkMiddleware` corre en el servidor en todas las rutas, salvo estáticos, para que `auth()` funcione
    en páginas y API;
  - solo redirige en `/dashboard(.*)`, `/registro(.*)` y `/entrar`, y en las demás rutas termina sin hacer nada.
  - No agregar rutas públicas a `esPrivada`, ni lógica que se ejecute en rutas públicas.
  - Cambiar el `matcher` es una decisión aparte: afecta a `auth()` en las rutas de API.
- Para la sesión en el navegador usar `useSesion()` (`lib/sesion-cliente.tsx`). No usar los hooks de Clerk
  directamente en componentes compartidos.

## Idiomas (ES/EN)
- Todo texto visible va en español e inglés. El español es el idioma por omisión.
- `useLanguage()` (`lib/language-context.tsx`) da `{ language, setLanguage, t }`.
  - `t("clave")` busca en el diccionario `translations` de ese archivo. Agregar la clave en **`es` y en `en`**.
  - Para textos sueltos de un módulo, un objeto `{ es, en }` leído con `[language]`.
    Ejemplo: `AVISO_PAGOS` en `lib/pagos-en-linea.ts`.
- El idioma se guarda en el navegador (`lib/idioma-guardado.ts`). El servidor siempre usa el idioma por omisión.

## Pagos
- Stripe está **apagado en producción** (decisión de producto). Se paga en el salón.
- El backend avisa con `pagosEnLinea: false` en `GET /client/payment-methods`, y el front lo lee con
  `pagosEnLineaDe()`. Con pagos apagados, no ofrecer recargas ni guardar tarjetas: mostrar `AVISO_PAGOS`.
- No reactivar pagos ni cambiar cobros sin decisión explícita de producto.

## Datos y API
- En el navegador: `api(ruta, init)` de `lib/api.ts` (agrega la sesión y la URL del backend).
- En el servidor: `apiServidor(ruta, init)` de `lib/api-servidor.ts`.
- No llamar a `fetch` contra el backend a mano. Variables de entorno de servidor con `requireEnv()` (`lib/env.ts`).

## Convenciones de código
- Server Components por defecto. `'use client'` solo con estado, efectos, eventos o hooks del navegador.
  Si solo una parte es interactiva, sacar esa parte a un componente cliente.
- TypeScript estricto. **Prohibido `any`**: usar `unknown` y estrechar, o tipos explícitos.
- Nombres nuevos (variables, funciones, archivos) y comentarios **en español**. Hay nombres heredados en inglés
  (`client-dashboard-shell.tsx`, `register/`): no renombrarlos sin pedirlo.
- Comentarios que explican el porqué, no el qué. JSDoc corto encima de funciones exportadas.
- Tailwind para estilos. Reutilizar componentes de `components/` (`campo.tsx`, `toast.tsx`, shells de panel)
  antes de crear otros.
- Avisos al usuario con `useToast()` de `@/components/toast`. No usar `alert()` en código nuevo.

## Pruebas
- Vitest, entorno `node` (sin DOM). Solo cuenta `apps/web/tests/**/*.test.ts`.
- Puntuales, desde `apps/web`: `npx vitest run tests/<archivo>.test.ts`. Todas: `npm test` (raíz).
- Estilo del repo:
  - lógica pura en `lib/` probada directamente;
  - reglas de pantallas probadas leyendo el fuente (`readFileSync`), como en `tests/estado-cita.test.ts`.
- Antes de un commit: la prueba puntual, `npm run lint` y, si se toca algo transversal, `npm test`.
- Validar que las pruebas nuevas detectan la falla: romper el código a propósito y ver que fallan (mutación).

## Flujo de trabajo
- Plan corto, esperar confirmación, implementar, probar y un commit por cambio, en una rama (nunca en `main`).
- Decisiones de producto (horarios, cancelaciones, asignación, cobros, permisos): preguntar antes.
- Sin secretos en código, commits ni salida. Los `.env*` no se imprimen.
- Para crear o cambiar pantallas de panel, usar la skill `nueva-vista-dashboard`.
