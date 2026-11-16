/**
 * Borrado seguro de cuentas desde la administración (synova-backend: GET /admin/users/:id/borrado y
 * DELETE /admin/users/:id). Solo se borra una cuenta sin historial; con historial se sugiere suspender.
 * Aquí está la lógica sin interfaz: rutas, texto del desglose, confirmación por correo y mensajes de error.
 */

/** Lo que impide borrar (mismo formato que devuelve el backend). */
export type DesgloseDeHistorial = {
  citas: number;
  movimientos: number;
  /** Saldo del monedero como texto ("0.00"). */
  saldo: string;
  stripe: boolean;
  tickets: number;
};

export type RevisionDeBorrado = {
  sePuede: boolean;
  desglose: DesgloseDeHistorial;
  usuario: { email: string; tipo: "cliente" | "negocio" };
};

export type AccionDeUsuario = "delete" | "ban" | "unban";

export const rutaDeRevision = (userId: string) => `/api/admin/users/${encodeURIComponent(userId)}/borrado`;
export const rutaDeBorrado = (userId: string) => `/api/admin/users/${encodeURIComponent(userId)}`;

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Una línea por cada motivo que impide borrar, en el orden en que se muestran. Vacío si no hay historial. */
export function describirHistorial(d: DesgloseDeHistorial): string[] {
  const motivos: string[] = [];
  if (d.citas > 0) motivos.push(plural(d.citas, "cita (incluidas canceladas)", "citas (incluidas canceladas)"));
  if (d.movimientos > 0) motivos.push(plural(d.movimientos, "movimiento del monedero", "movimientos del monedero"));
  if (Number(d.saldo) > 0) motivos.push(`saldo de $${d.saldo} en el monedero`);
  if (d.stripe) motivos.push("cliente registrado en Stripe");
  if (d.tickets > 0) motivos.push(plural(d.tickets, "ticket de soporte", "tickets de soporte"));
  return motivos;
}

/** El correo escrito para confirmar coincide con el de la cuenta (sin espacios ni mayúsculas). Vacío nunca coincide. */
export function correoCoincide(escrito: string, real: string): boolean {
  const a = escrito.trim().toLowerCase();
  return a.length > 0 && a === real.trim().toLowerCase();
}

const QUE: Record<AccionDeUsuario, string> = {
  delete: "eliminar",
  ban: "suspender",
  unban: "reactivar",
};

/**
 * Mensaje para la administración cuando una acción falla: el error que manda el backend (con el desglose si la
 * cuenta tiene historial) o, si no hay cuerpo legible, uno según el estado HTTP.
 */
export async function mensajeDeError(respuesta: Response, accion: AccionDeUsuario): Promise<string> {
  let cuerpo: { error?: unknown; codigo?: unknown; desglose?: DesgloseDeHistorial } = {};
  try {
    cuerpo = (await respuesta.json()) as typeof cuerpo;
  } catch {
    cuerpo = {};
  }
  const base =
    typeof cuerpo.error === "string" && cuerpo.error.trim()
      ? cuerpo.error.trim()
      : respuesta.status === 502
        ? `No se pudo ${QUE[accion]} la cuenta en el servicio de inicio de sesión. Intenta de nuevo.`
        : `No se pudo ${QUE[accion]} al usuario (error ${respuesta.status}).`;
  if (cuerpo.codigo === "con-historial" && cuerpo.desglose) {
    const motivos = describirHistorial(cuerpo.desglose);
    if (motivos.length > 0) return `${base} Tiene: ${motivos.join(", ")}.`;
  }
  return base;
}
