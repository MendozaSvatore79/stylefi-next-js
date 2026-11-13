# StyleFi

Plataforma de agendamiento de citas para salones y barberías.

## Estructura (monorepo con npm workspaces)

```
apps/web/         Next.js (front y, por ahora, las rutas app/api). Se despliega en Vercel (Root Directory: apps/web).
packages/shared/  Reglas de horarios libres, zona horaria, estados de cita y plazo de 2 horas.
compose.yaml      PostgreSQL 17 local.
```

El backend nuevo (NestJS + Drizzle, con el esquema y las migraciones de la base) está en el repo
[synova-backend](https://github.com/MendozaSvatore79/synova-backend). Las rutas de `apps/web/app/api` se
irán pasando allá por grupos; mientras tanto conviven.

## Levantar todo en local

Requisitos: Node 24 o más nuevo y Docker. Clona también `synova-backend` (tiene las migraciones).

```bash
npm install
npm run db:arriba                              # PostgreSQL en 127.0.0.1:54329
cp apps/web/.env.example apps/web/.env.local   # y pon las llaves de Clerk (instancia de desarrollo)
# En synova-backend: npm install && cp .env.example .env.local && npm run db:migrar
npm run dev                                    # front en http://localhost:3000
npm run demo                                   # datos de demostración; muestra las contraseñas una vez
```

La base es la misma desde los dos repos (mismo contenedor `stylefi-postgres` y volumen). Si arrancas el front
sin haber migrado, la app crea las tablas por su cuenta (`ensureStylehubSchema`); en ese caso registra la base
una vez desde `synova-backend` con `npm run db:migrar -- --marcar-base`.

Otros comandos (desde la raíz):

| Comando | Qué hace |
|---|---|
| `npm test` | Pruebas del front y de `packages/shared` (Vitest). |
| `npm run lint` | ESLint del front. |
| `npm run build` | Compila el front (y `packages/shared` antes). |
| `npm run asignar-admin -- correo@dominio.com "Nombre"` | Da el rol de administración a un correo (solo desde la terminal). |
| `npm run db:abajo` | Apaga la base local sin borrar datos. |

## Base de datos: esquema y migraciones

El esquema y las migraciones viven en `synova-backend` (`src/db/schema.ts` y `drizzle/`); ver su README.
`apps/web/lib/db-init.ts` está **congelado**: no le agregues tablas ni columnas; se borra cuando todas las
rutas estén en el API. `db/schema.sql` está desactualizado y también se borrará.

## Conexión a la base

- Front en Vercel (`apps/web/lib/db.ts`): cliente `postgres`, máximo 2 conexiones por instancia, SSL obligatorio.
  Solo `localhost` se conecta sin SSL. Con RDS Proxy hay que agregar `prepare: false`.
- El API (`synova-backend`) tiene su propia configuración de conexión; ver su README.

## Inicio de sesión (Clerk)

Clerk se encarga de entrar, registrarse, Google, verificar el correo, la contraseña y su recuperación. Los
**permisos** (cliente, negocio, admin, baneo) están en nuestra base (`stylehub_users`, columna `clerk_user_id`):

- `apps/web/lib/sesion.ts`: `obtenerSesion()` da la sesión de la app. Si alguien entra por primera vez con un
  correo **verificado** que ya tenía cuenta (sin vincular), se vincula sola; si no tiene cuenta, va a
  `/registro/completar` a elegir cliente o negocio.
- `proxy.ts`: Clerk en cada petición; `/dashboard`, `/registro` y `/entrar` piden sesión. Cada ruta de datos vuelve
  a verificar en la base.
- Cuenta baneada: `/cuenta-suspendida` (se le cierra la sesión de Clerk).
- Contraseña y correo: el perfil de Clerk (Ajustes → Seguridad → "Administrar mi acceso"). Eliminar la cuenta la
  borra en nuestra base y en Clerk.
- En local, con una instancia de desarrollo de Clerk, `npm run demo` crea las cuentas de demostración en Clerk
  (correos `+clerk_test`: si Clerk pide un código, es `424242`).

## Cuentas de administración

Son usuarios de la base con tipo `admin`. El rol se da **solo desde la terminal**:

```bash
npm run asignar-admin -- correo@dominio.com "Nombre"
```

Si el correo no tiene cuenta, crea una de administración sin contraseña: la persona entra con Clerk usando ese
correo y, al verificarlo, queda vinculada. No convierte en administración una cuenta de cliente o negocio. Todas
las rutas de `app/api/admin/` exigen esa sesión (`requireAdmin()` en `apps/web/lib/admin-auth.ts`).

## Archivos subidos

Los comprobantes de propiedad y las imágenes de sucursal se guardan en Postgres (tabla `stylehub_files`,
`apps/web/lib/storage.ts`), nunca en `public/`. El tipo se valida por el contenido: comprobantes en PDF, JPG,
PNG o WebP; imágenes en JPG, PNG o WebP; hasta 4 MB. Se sirven desde `/api/files/[id]`: las imágenes son
públicas y los comprobantes solo los ven el negocio dueño y la administración.

## Pruebas

`npm test` corre Vitest en el front y en `packages/shared`; no necesitan base de datos (las que sí, se saltan si no hay
una configurada). `apps/web/tests/admin-auth.test.ts` descubre todas las rutas de `app/api/admin/` y falla si
alguna no exige una sesión de administración.
