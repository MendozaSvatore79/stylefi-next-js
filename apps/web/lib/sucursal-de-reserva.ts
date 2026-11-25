/**
 * Sucursal de una reserva hecha desde «Mis citas». Cada servicio pertenece a una sucursal: la reserva se manda con
 * esa sucursal y solo se ofrecen estilistas de ella. Antes se reservaba sin sucursal (la cita quedaba sin dónde ir).
 */
export type ServicioConSucursal = { id: string; branch_id?: string | null };
export type SucursalBreve = { id: string; branch_name: string };

/** La sucursal del servicio elegido, o null si no hay servicio o es un dato viejo sin sucursal. */
export function sucursalDelServicio(servicios: ServicioConSucursal[], serviceId: string): string | null {
  return servicios.find((s) => s.id === serviceId)?.branch_id ?? null;
}

/** Estilistas que se pueden elegir: disponibles, que hacen el servicio y de su misma sucursal. */
export function estilistasParaElServicio<E extends { available?: boolean; service_ids?: string[]; branch_id?: string | null }>(
  estilistas: E[],
  serviceId: string,
  sucursal: string | null,
): E[] {
  return estilistas.filter(
    (e) => e.available !== false && (e.service_ids ?? []).includes(serviceId) && (!sucursal || !e.branch_id || e.branch_id === sucursal),
  );
}

/** Nombre de la sucursal para mostrar junto al servicio, solo si el negocio tiene más de una. */
export function sucursalVisible(sucursales: SucursalBreve[], branchId: string | null | undefined): string | null {
  if (sucursales.length < 2 || !branchId) return null;
  return sucursales.find((s) => s.id === branchId)?.branch_name ?? null;
}

/** «Sucursal Centro · Ciudad de México» para la tarjeta de la cita; null si la cita no tiene sucursal. */
export function lugarDeLaCita(cita: { branch_name?: string | null; branch_city?: string | null }): string | null {
  const partes = [cita.branch_name, cita.branch_city].map((x) => x?.trim()).filter(Boolean);
  return partes.length ? partes.join(" · ") : null;
}
