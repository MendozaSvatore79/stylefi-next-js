# StyleFi

Plataforma de agendamiento de citas para salones y barberías.

## Estructura (monorepo con npm workspaces)

```
apps/web/         Next.js (front y, por ahora, las rutas app/api). Se despliega en Vercel (Root Directory: apps/web).
apps/api/         NestJS + Drizzle: el backend nuevo. Se desplegará en AWS junto a la base (RDS).
packages/shared/  Reglas que usan los dos: horarios libres, zona horaria, estados de cita, plazo de 2 horas.
compose.yaml      PostgreSQL 17 local (y el API en contenedor, opcional).
```

Las rutas de `apps/web/app/api` se irán pasando a `apps/api` por grupos; mientras tanto conviven.

## Levantar todo en local

Requisitos: Node 24 o más nuevo y Docker.

```bash
npm install
npm run db:arriba                              # PostgreSQL en 127.0.0.1:54329
cp apps/web/.env.example apps/web/.env.local   # y completa NEXTAUTH_SECRET (openssl rand -hex 32)
cp apps/api/.env.example apps/api/.env.local
npm run db:migrar                              # crea o actualiza las tablas
npm run dev                                    # front en http://localhost:3000
npm run dev:api                                # API en http://localhost:4000 (GET /health)
npm run demo                                   # datos de demostración; muestra las contraseñas una vez
```

Otros comandos (desde la raíz):

| Comando | Qué hace |
|---|---|
| `npm test` | Pruebas de los tres paquetes (Vitest). |
| `npm run lint` | ESLint del front. |
| `npm run build` | Compila el front (y `packages/shared` antes). |
| `npm run api:docker` | Construye y levanta el API en un contenedor, junto a la base. |
| `npm run crear-admin -- correo@dominio.com "Nombre"` | Crea una cuenta de administración (o le pone contraseña nueva). |
| `npm run db:abajo` | Apaga la base local sin borrar datos. |

## Base de datos: esquema y migraciones

El esquema vive en `apps/api/src/db/schema.ts` (Drizzle) y cambia **solo con migraciones** en
`apps/api/drizzle/`:

1. Edita `schema.ts`.
2. `npm run db:generar -w @stylefi/api -- --name descripcion_del_cambio` genera la migración SQL; revísala.
3. `npm run db:migrar` la aplica (en producción, antes de arrancar la versión nueva:
   `node apps/api/dist/db/migrar.js` dentro de la imagen del API).

Lo que Drizzle no expresa (extensiones, la restricción `EXCLUDE` que impide citas encimadas) va como SQL
a mano dentro de la migración.

Una base que ya creó la versión anterior de la app (con `ensureStylehubSchema`) no se migra desde cero: se
registra como "ya en la versión 0000" sin tocar tablas, con `npm run db:migrar -- --marcar-base` (se niega si
la base está incompleta o ya marcada).

`apps/web/lib/db-init.ts` está **congelado**: no le agregues tablas ni columnas; se borra cuando todas las
rutas estén en el API. `db/schema.sql` está desactualizado y también se borrará.

Pruebas de migraciones contra PostgreSQL real (crean y borran bases temporales; solo con una base local):

```bash
PRUEBAS_ADMIN_DATABASE_URL=postgres://stylefi:stylefi-local@127.0.0.1:54329/stylefi npm test -w @stylefi/api
```

## Conexión a la base

- Front en Vercel (`apps/web/lib/db.ts`): cliente `postgres`, máximo 2 conexiones por instancia, SSL obligatorio.
- API (`apps/api/src/db/conexion.ts`): pool de 10 conexiones, SSL obligatorio.
- Solo `localhost` (y `postgres`, dentro de Docker) se conectan sin SSL.
- Con RDS Proxy hay que agregar `prepare: false` en ambos.

## Cuentas de administración

Son usuarios de la base con tipo `admin` (ya no se usan `ADMIN_EMAIL`/`ADMIN_PASSWORD`):

```bash
npm run crear-admin -- correo@dominio.com "Nombre"
```

Lee `DATABASE_URL` de `apps/web/.env.local`. Si no defines `CREAR_ADMIN_PASSWORD` (12+ caracteres), genera una
contraseña y la muestra una sola vez. Todas las rutas de `app/api/admin/` exigen esa sesión (`requireAdmin()`
en `apps/web/lib/admin-auth.ts`).

## Archivos subidos

Los comprobantes de propiedad y las imágenes de sucursal se guardan en Postgres (tabla `stylehub_files`,
`apps/web/lib/storage.ts`), nunca en `public/`. El tipo se valida por el contenido: comprobantes en PDF, JPG,
PNG o WebP; imágenes en JPG, PNG o WebP; hasta 4 MB. Se sirven desde `/api/files/[id]`: las imágenes son
públicas y los comprobantes solo los ven el negocio dueño y la administración.

## Pruebas

`npm test` corre Vitest en los tres paquetes; no necesitan base de datos (las que sí, se saltan si no hay
una configurada). `apps/web/tests/admin-auth.test.ts` descubre todas las rutas de `app/api/admin/` y falla si
alguna no exige una sesión de administración.
