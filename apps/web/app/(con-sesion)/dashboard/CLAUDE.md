# Paneles (`/dashboard/*`): reglas compartidas

Tres paneles, uno por tipo de cuenta: `cliente/`, `negocio/` y `admin/`. Cada uno tiene `layout.tsx` y un shell
en `components/` (`client-`, `business-` y `admin-dashboard-shell.tsx`) con el menú y el marco.
Para crear o cambiar una pantalla, seguir la skill `nueva-vista-dashboard`.

## Sesión y acceso
- Hay tres capas, y ninguna sustituye a las otras:
  1. `proxy.ts` manda a `/iniciar-sesion` si no hay sesión de Clerk;
  2. el `layout.tsx` de cada panel llama a `accesoAlPanel("<tipo>")` (`lib/sesion.ts`) y hace `redirect()` si el
     backend dice que la cuenta es de otro tipo, está suspendida o le falta el registro;
  3. el backend vuelve a verificar la cuenta y sus permisos en cada petición.
- No quitar ni saltarse el `accesoAlPanel` del layout. Una pantalla nueva dentro de un panel ya queda protegida
  por su layout: no repetir la verificación en la página.
- En componentes cliente, la sesión se obtiene con `useSesion()` (`lib/sesion-cliente.tsx`), que devuelve
  `{ data, status: "loading" | "authenticated" | "unauthenticated" }`. No usar los hooks de Clerk directamente.

## Permisos por rol
- Cada panel solo muestra y llama a endpoints de su rol (`/api/business/*` para negocio, por ejemplo).
- Ocultar un botón no es seguridad. Si una acción necesita un permiso, el backend la rechaza: manejar su 403
  con un toast, sin dar por hecho que salió bien.
- Cambiar quién puede hacer qué es una decisión de producto: preguntar antes.

## Carga y errores
- Datos con `api()` (`lib/api.ts`) en componentes cliente, o con `apiServidor()` en componentes de servidor.
- Toda carga o acción tiene tres estados visibles: cargando (texto o esqueleto, y botón deshabilitado mientras
  se envía), vacío y error.
- Errores y confirmaciones con `useToast().showToast({ type: "success" | "error" | "info", title, message })`.
  Si la respuesta no es `ok`, avisar con un toast; no devolver en silencio. Hay código viejo que todavía lo hace:
  no copiarlo.
- Evitar respuestas viejas: si la petición puede repetirse (filtros, cambio de sucursal), ignorar la que llegue
  tarde.

## Textos
- Todo texto visible va en ES y EN: títulos, botones, toasts, `aria-label`, `placeholder` y mensajes vacíos.
- Usar `t("clave")` de `useLanguage()`, con la clave en `es` y `en` de `lib/language-context.tsx`, o un objeto
  `{ es, en }` local leído con `[language]`.
- Fechas, horas y estados de cita con `fechaHoraCita()` y `etiquetaEstado()` de `@stylefi/shared`, nunca crudos.
