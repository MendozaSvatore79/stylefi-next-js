# StyleFi

Plataforma de agendamiento de citas para salones y barberías.

## Estructura (monorepo con npm workspaces)

```
apps/web/         Next.js: las pantallas. Se despliega en Vercel (Root Directory: apps/web).
packages/shared/  Reglas de horarios libres, zona horaria, estados de cita y plazo de 2 horas.
compose.yaml      PostgreSQL 17 local (la misma base que usa synova-backend).
```

Desde la fase 4 el front **no tiene rutas de datos ni lee la base**: todo (catálogo, citas, pagos, cuenta, admin,
soporte) vive en el backend [synova-backend](https://github.com/MendozaSvatore79/synova-backend) (NestJS + Prisma),
que tiene el esquema, las migraciones, la demo y el comando para dar el rol de administración.

## Levantar todo en local

Requisitos: Node 24 o más nuevo y Docker. Clona también `synova-backend`.

```bash
npm install
npm run db:arriba                              # PostgreSQL en 127.0.0.1:54329
cp apps/web/.env.example apps/web/.env.local   # llaves de Clerk (desarrollo) y NEXT_PUBLIC_API_URL=http://localhost:4000
# En synova-backend: npm install && cp .env.example .env.local && npm run db:migrar && npm run start:dev
# Datos de demostración (en synova-backend): npm run demo  (muestra las contraseñas una vez: guárdalas en privado)
npm run dev                                    # front en http://localhost:3000
```

`NEXT_PUBLIC_API_URL` es obligatoria: sin ella el front no compila ni arranca (lo revisa `apps/web/next.config.ts`).

Otros comandos (desde la raíz):

| Comando | Qué hace |
|---|---|
| `npm test` | Pruebas del front y de `packages/shared` (Vitest). |
| `npm run lint` | ESLint del front. |
| `npm run build` | Compila el front (y `packages/shared` antes). |
| `npm run db:abajo` | Apaga la base local sin borrar datos. |

## Imagen Docker del frontend

La imagen se construye desde la raíz del monorepo. Exporta antes `NEXT_PUBLIC_API_URL`,
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` y `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` en la terminal; son valores públicos
incorporados al compilar:

```bash
docker build -t stylefi-web:local \
  --build-arg NEXT_PUBLIC_API_URL \
  --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
  --build-arg NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY .
docker run --rm -p 3001:3000 -e CLERK_SECRET_KEY stylefi-web:local
```

Antes de ejecutar el contenedor, configura `CLERK_SECRET_KEY` en el entorno privado de la terminal. La aplicación
queda en `http://localhost:3001`. Las claves privadas se inyectan solo en ejecución; no deben incluirse en argumentos
de build ni en la imagen.

## Cómo llama el front al backend

- `apps/web/lib/api.ts`: `api("/api/…")` llama a `NEXT_PUBLIC_API_URL + "/…"` con el token de sesión de Clerk. Las
  pantallas escriben las rutas con `/api` y responden igual que antes. `urlArchivo()` arma la URL de imágenes, y
  `abrirArchivoPrivado()` descarga los comprobantes con el token.
- `apps/web/lib/api-servidor.ts`: lo mismo desde páginas y layouts que se arman en el servidor.

## Inicio de sesión (Clerk)

Clerk se encarga de entrar, registrarse, Google, verificar el correo, la contraseña y su recuperación. Los
**permisos** (cliente, negocio, admin, baneo) los decide el backend con nuestra base:

- `apps/web/lib/sesion.ts`: los layouts de los paneles y `/registro/completar` preguntan a `GET /entrar` del backend
  a dónde va la persona (su panel, completar el registro, cuenta suspendida o iniciar sesión). El backend vincula
  solo una cuenta existente cuando la persona entra con su correo **verificado**.
- `apps/web/lib/sesion-cliente.tsx`: `useSesion()` en el navegador (`GET /sesion` del backend; la foto y si entró con
  Google salen de Clerk).
- `proxy.ts`: Clerk en cada petición; `/dashboard`, `/registro` y `/entrar` piden sesión.
- Cuenta baneada: `/cuenta-suspendida`.
- En local, `npm run demo` (en `synova-backend`) crea las cuentas de demostración en Clerk de desarrollo (correos
  `+clerk_test`: si Clerk pide un código, es `424242`).

## Cuentas de administración

El rol se da **solo desde la terminal**, en `synova-backend`:

```bash
npm run asignar-admin -- correo@dominio.com "Nombre"
```

## Pruebas

`npm test` corre Vitest en el front y en `packages/shared`; no necesitan base de datos. Las reglas de datos (citas,
pagos, permisos) se prueban en `synova-backend` contra PostgreSQL real.
