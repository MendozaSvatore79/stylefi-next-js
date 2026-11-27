import { esFecha, fechaLocal, limitesDelDia } from "@stylefi/shared";

/** Mismos topes que el backend (/admin/appointments): rango por omisión ±30 días y máximo 92 días por consulta. */
export const DIAS_POR_OMISION_CITAS = 30;
export const DIAS_MAXIMOS_CITAS = 92;
const DIA_MS = 24 * 60 * 60 * 1000;

export const ESTADOS_SUCURSAL = ["pending", "approved", "rejected"] as const;
export type EstadoSucursal = (typeof ESTADOS_SUCURSAL)[number];

/** Fechas de calendario (hora de México) para los campos de fecha: 30 días atrás y 30 adelante de hoy. */
export function rangoInicialDeCitas(ahora: Date): { desde: string; hasta: string } {
  return {
    desde: fechaLocal(new Date(ahora.getTime() - DIAS_POR_OMISION_CITAS * DIA_MS)),
    hasta: fechaLocal(new Date(ahora.getTime() + DIAS_POR_OMISION_CITAS * DIA_MS)),
  };
}

export type FiltrosCitas = {
  desde: string;
  hasta: string;
  negocio?: string | null;
  sucursal?: string | null;
  estado?: string;
  pagina?: number;
};

export type ErrorDeRango = "fecha" | "orden" | "rango";

/**
 * Parámetros de GET /api/admin/appointments. Las fechas son días de calendario en hora de México y el día final
 * cuenta completo: se mandan como instantes [inicio de `desde`, fin de `hasta`). Mandar "AAAA-MM-DD" tal cual
 * haría que el backend lo leyera como medianoche UTC (18:00 del día anterior en México).
 */
export function consultaDeCitas(f: FiltrosCitas): { query: string } | { error: ErrorDeRango } {
  if (!esFecha(f.desde) || !esFecha(f.hasta)) return { error: "fecha" };
  if (f.hasta < f.desde) return { error: "orden" };
  const from = limitesDelDia(f.desde).start;
  const to = limitesDelDia(f.hasta).end;
  if (to.getTime() - from.getTime() > DIAS_MAXIMOS_CITAS * DIA_MS) return { error: "rango" };
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  if (f.negocio) params.set("businessId", f.negocio);
  if (f.sucursal) params.set("branchId", f.sucursal);
  if (f.estado && f.estado !== "all") params.set("status", f.estado);
  if (f.pagina && f.pagina > 1) params.set("page", String(f.pagina));
  return { query: params.toString() };
}

/** Parámetros de GET /api/admin/businesses. */
export function consultaDeNegocios(f: { busqueda?: string; estado?: string; pagina?: number }): string {
  const params = new URLSearchParams();
  const busqueda = f.busqueda?.trim();
  if (busqueda) params.set("search", busqueda);
  if (f.estado && f.estado !== "all") params.set("status", f.estado);
  if (f.pagina && f.pagina > 1) params.set("page", String(f.pagina));
  return params.toString();
}

/** Enlace a las citas de un negocio (o de una de sus sucursales); el nombre solo sirve para mostrar el filtro. */
export function rutaDeCitasDe(negocio: { id: string; nombre: string }, sucursal?: { id: string; nombre: string }) {
  const params = new URLSearchParams({ negocio: negocio.id, nombre: negocio.nombre });
  if (sucursal) {
    params.set("sucursal", sucursal.id);
    params.set("nombreSucursal", sucursal.nombre);
  }
  return `/dashboard/admin/citas?${params.toString()}`;
}

/** Nombre visible de un negocio: el comercial, o el del dueño, o el correo. */
export function nombreDeNegocio(n: {
  business_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
}): string {
  const comercial = n.business_name?.trim();
  if (comercial) return comercial;
  const dueno = [n.first_name, n.last_name].filter(Boolean).join(" ").trim();
  return dueno || n.email;
}
