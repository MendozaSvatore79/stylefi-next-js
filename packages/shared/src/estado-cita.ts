import { ZONA_HORARIA } from "./availability.js";

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

/**
 * Si la cita es del historial y el cliente puede borrarla: completada o cancelada, o que ya pasó. Es la misma regla
 * que aplica el servidor en DELETE /client/appointments. Una cita futura activa no se borra: se cancela.
 */
export function esDelHistorial(cita: { status: string; scheduled_at: string | Date }, ahora: Date = new Date()): boolean {
  return cita.status === "completed" || cita.status === "cancelled" || new Date(cita.scheduled_at).getTime() < ahora.getTime();
}

/** Fecha y hora de la cita en la zona del negocio, formato corto: "14 nov 2026, 10:00 a.m.". */
export function fechaHoraCita(fecha: string | Date, language: string): string {
  return new Date(fecha).toLocaleString(language === "en" ? "en-US" : "es-MX", {
    timeZone: ZONA_HORARIA,
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Días tras la hora de la cita en que una cita que el negocio no cerró deja de pedirse como "por cerrar" y se muestra
 * como "Pasada sin confirmar" (decisión de producto del 2026-11-25). El servidor usa el mismo número.
 */
export const DIAS_PARA_SIN_CONFIRMAR = 7;

/**
 * Cita pendiente o confirmada cuya hora ya pasó, que el negocio no ha cerrado (completada o no asistió). No cambia
 * su estado en la base: es un estado calculado para mostrar y contar.
 * - "por-cerrar": pasó hace 7 días o menos; se le pide al negocio que la cierre.
 * - "sin-confirmar": pasó hace más de 7 días; sale de las activas y de los reportes, y aún se puede cerrar.
 * - null: no está activa o todavía no llega su hora.
 */
export function cierrePendiente(
  cita: { status: string; scheduled_at: string | Date },
  ahora: Date = new Date(),
): "por-cerrar" | "sin-confirmar" | null {
  if (cita.status !== "pending" && cita.status !== "confirmed") return null;
  const pasado = ahora.getTime() - new Date(cita.scheduled_at).getTime();
  if (pasado < 0) return null;
  return pasado > DIAS_PARA_SIN_CONFIRMAR * 24 * 60 * 60_000 ? "sin-confirmar" : "por-cerrar";
}

const ETIQUETA_SIN_CONFIRMAR = { es: "Pasada sin confirmar", en: "Past, unconfirmed" };

/** Etiqueta de la cita para mostrar: "Pasada sin confirmar" si corresponde; si no, la de su estado. */
export function etiquetaDeCita(
  cita: { status: string; scheduled_at: string | Date },
  language: string,
  ahora: Date = new Date(),
): string {
  return cierrePendiente(cita, ahora) === "sin-confirmar"
    ? ETIQUETA_SIN_CONFIRMAR[language === "en" ? "en" : "es"]
    : etiquetaEstado(cita.status, language);
}
