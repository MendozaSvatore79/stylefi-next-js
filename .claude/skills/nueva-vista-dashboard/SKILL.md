---
name: nueva-vista-dashboard
description: Guía paso a paso para crear o modificar pantallas y componentes dentro de /dashboard/cliente, /dashboard/negocio o /dashboard/admin (App Router de Next 16, React 19, Tailwind, textos ES/EN, toasts y prueba con Vitest). Usar al agregar una página, una sección, un formulario o una entrada de menú en un panel.
---

# Nueva vista (o cambio) en un panel

Las reglas de fondo están en `apps/web/app/(con-sesion)/dashboard/CLAUDE.md` y en el `CLAUDE.md` raíz.
Esta guía es el orden de trabajo. Rutas relativas a `apps/web/`.

## 1. Ubicar y planear
- ¿Qué rol? Elegir la carpeta: `app/(con-sesion)/dashboard/{cliente|negocio|admin}/<seccion>/`.
- Buscar una pantalla parecida en el mismo panel y copiar su estructura. No inventar patrones nuevos.
- ¿Qué endpoint del backend usa? Confirmar ruta y forma de la respuesta en `synova-backend`, sin suponerlas.
- Si hay decisiones de producto (quién puede, horarios, cobros, cancelaciones), preguntar **antes** de escribir.
- Mostrar el plan corto y esperar confirmación.

## 2. Revisar la API de Next 16
- Antes de usar algo de Next (`page.tsx` con `params`/`searchParams` asíncronos, `redirect`, `Link`, `useRouter`,
  caché o metadatos), leer la guía en `node_modules/next/dist/docs/`. Next 16 cambia APIs que se recuerdan de versiones anteriores.

## 3. Página
- `page.tsx` va en la carpeta de la sección. El `layout.tsx` del panel ya protege con `accesoAlPanel()`: no
  repetir la verificación.
- Server Component por defecto. Si la pantalla necesita estado, efectos o eventos, aislar esa parte en un
  componente con `'use client'`, junto a la página o en `components/` si se reutiliza.
  La mayoría de las pantallas actuales son cliente completas; está bien seguir ese patrón si la pantalla es casi
  toda interactiva.
- TypeScript sin `any`. Tipar la respuesta del API con un `type` local y estrechar con `unknown` si viene sin forma.
- Nombres y comentarios nuevos en español.

## 4. Datos, estados y toasts
```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import { useLanguage } from "@/lib/language-context";
import { api } from "@/lib/api";

type Servicio = { id: string; nombre: string };

export default function VistaEjemplo() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [servicios, setServicios] = useState<Servicio[] | null>(null); // null = cargando

  const cargar = useCallback(async () => {
    const respuesta = await api("/api/business/services", { cache: "no-store" });
    if (!respuesta.ok) {
      showToast({ type: "error", title: t("comun.error"), message: t("servicios.errorCarga") });
      setServicios([]);
      return;
    }
    const datos = (await respuesta.json()) as { services?: Servicio[] };
    setServicios(datos.services ?? []);
  }, [showToast, t]);

  useEffect(() => { void cargar(); }, [cargar]);
  // render: servicios === null → cargando; [] → vacío; lista → contenido
}
```
- Los nombres de claves y endpoints de arriba son de ejemplo: usar los reales.
- Mientras se envía un formulario, deshabilitar el botón. Al terminar, toast de éxito o de error.
- Si la petición se repite (filtros, sucursal), descartar las respuestas viejas.
- Con react-hooks 7, `react-hooks/set-state-in-effect` avisa (es `warn` en `eslint.config.mjs`) al cargar datos
  desde un efecto, como en el ejemplo. Se tolera hasta cambiar de patrón: no agregar errores nuevos de lint.

## 5. Textos ES/EN
- Cada texto visible (incluidos `aria-label`, `placeholder`, toasts y estados vacíos) lleva su clave en
  `translations.es` **y** en `translations.en` de `lib/language-context.tsx`, o va en un objeto `{ es, en }` local.
- Fechas y estados de cita: `fechaHoraCita()` y `etiquetaEstado()` de `@stylefi/shared`.

## 6. Menú (si la pantalla es nueva)
- Agregar `{ href, labelKey, icon }` a `MENU_ITEMS` del shell del panel (`components/client-`, `business-` o
  `admin-dashboard-shell.tsx`). El icono es de `lucide-react` y la `labelKey` va en ES y EN.

## 7. Estilos
- Tailwind, con los colores y espaciados de las pantallas vecinas. Reutilizar `components/campo.tsx` para los campos
  con etiqueta: la etiqueta es visible, no basta con un `placeholder`.
- Revisar móvil (sin scroll horizontal) y teclado (foco visible, botones con nombre).

## 8. Prueba (Vitest, entorno node, sin DOM)
- Si hay lógica (cálculos, transformaciones, validación), sacarla a `lib/<nombre>.ts` y probarla directamente en
  `tests/<nombre>.test.ts`.
- Para reglas de pantalla (usa el helper X, no muestra Y crudo), leer el fuente con `readFileSync`, como en
  `tests/estado-cita.test.ts`.
- Pruebas de mutación: romper a propósito lo que se prueba, ver que la prueba falla y revertir.
- Correr:
  ```bash
  cd apps/web && npx vitest run tests/<nombre>.test.ts
  npx vitest run tests/clerk-fuera-de-portada.test.ts   # si se tocó algo de components/ o lib/
  npm run lint
  ```
  Si se cambió `packages/shared`: `npm run build -w @stylefi/shared` antes de probar.

## 9. Cierre
- Un commit por cambio, en una rama. Sin push ni PR sin permiso.
- Para revisar en el navegador: Chrome headless con un script de Node vía DevTools Protocol, con cuentas temporales
  que se borran al terminar.
- Registrar el paso en `AUDITORIA.md` y actualizar `SEGUIMIENTO.md`.
