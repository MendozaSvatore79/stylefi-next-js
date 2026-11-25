/**
 * Pestañas del panel de administración. La activa vive en `?pestana=` y no en el `#`: un `<Link>` de Next a un `#`
 * de la misma página solo hace scroll (no dispara `hashchange`), y por eso el menú lateral no cambiaba de pestaña.
 */
export const PESTANAS_ADMIN = ["resumen", "verificaciones", "modulos", "usuarios", "auditoria"] as const;

export type PestanaAdmin = (typeof PESTANAS_ADMIN)[number];

const RAIZ = "/dashboard/admin";

/** Pestaña que corresponde al valor de `?pestana=`; cualquier otro valor (o ninguno) abre el resumen. */
export function pestanaAdmin(valor: string | null | undefined): PestanaAdmin {
  return (PESTANAS_ADMIN as readonly string[]).includes(valor ?? "") ? (valor as PestanaAdmin) : "resumen";
}

/** URL de una pestaña: el resumen es la raíz del panel, sin parámetro. */
export function rutaDePestana(pestana: PestanaAdmin): string {
  return pestana === "resumen" ? RAIZ : `${RAIZ}?pestana=${pestana}`;
}
