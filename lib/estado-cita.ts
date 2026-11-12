/** Estados de una cita: nombre para mostrar y color de la etiqueta (mismos en todas las pantallas). */

export const ESTADOS_CITA = ["pending", "confirmed", "completed", "no_show", "cancelled"] as const;
export type EstadoCita = (typeof ESTADOS_CITA)[number];

const ETIQUETAS: Record<EstadoCita, { es: string; en: string }> = {
  pending: { es: "Pendiente", en: "Pending" },
  confirmed: { es: "Confirmada", en: "Confirmed" },
  completed: { es: "Completada", en: "Completed" },
  no_show: { es: "No asistió", en: "No-show" },
  cancelled: { es: "Cancelada", en: "Cancelled" },
};

const COLORES: Partial<Record<EstadoCita, string>> = {
  confirmed: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
};
const COLOR_NEUTRO = "bg-slate-200 text-slate-700";

const esEstado = (s: string): s is EstadoCita => (ESTADOS_CITA as readonly string[]).includes(s);

/** Nombre del estado en el idioma pedido; un estado desconocido se muestra tal cual. */
export function etiquetaEstado(status: string, language: string): string {
  return esEstado(status) ? ETIQUETAS[status][language === "en" ? "en" : "es"] : status;
}

/** Clases de color de la etiqueta: verde confirmada, ámbar pendiente, gris el resto. */
export function colorEstado(status: string): string {
  return (esEstado(status) && COLORES[status]) || COLOR_NEUTRO;
}

/** Plazo del cliente para cancelar o reagendar (decisión de producto del 2026-11-12). El servidor usa el mismo. */
export const PLAZO_CLIENTE_MIN = 120;

/**
 * Si el cliente puede reagendar o cancelar (la misma regla que aplica el servidor):
 * - "permitido": pendiente o confirmada y faltan más de 2 horas;
 * - "fuera-de-plazo": sigue activa, pero faltan 2 horas o menos (o ya pasó);
 * - "cerrada": cancelada, completada o no asistió.
 */
export function puedeModificarCliente(
  cita: { status: string; scheduled_at: string | Date },
  ahora: Date = new Date(),
): "permitido" | "fuera-de-plazo" | "cerrada" {
  if (cita.status !== "pending" && cita.status !== "confirmed") return "cerrada";
  const inicio = new Date(cita.scheduled_at).getTime();
  return inicio > ahora.getTime() + PLAZO_CLIENTE_MIN * 60_000 ? "permitido" : "fuera-de-plazo";
}
