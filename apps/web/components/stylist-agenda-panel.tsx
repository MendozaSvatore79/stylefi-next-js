"use client";

import { useEffect, useState } from "react";

import { useToast } from "@/components/toast";
import { useLanguage } from "@/lib/language-context";

type Servicio = { id: string; service_name: string; branch_id: string | null; duration_minutes: number | null };
type Bloque = { dayOfWeek: number; start: string; end: string };
type Ausencia = { id: string; starts_at: string; ends_at: string; reason: string | null };

const DIAS = {
  es: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"],
  en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
};
const fechaHora = new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", dateStyle: "medium", timeStyle: "short" });

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { cache: "no-store", headers: { "Content-Type": "application/json" }, ...init });
  const datos = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(datos.error ?? "Error");
  return datos;
}

/**
 * Servicios, horario semanal y ausencias de un estilista. Sin servicios u horario no recibe citas:
 * la disponibilidad sale de aquí (lib/availability.ts). El descanso es el hueco entre bloques.
 */
export default function StylistAgendaPanel({
  stylistId,
  branchId,
  serviceIds,
  onSaved,
}: {
  stylistId: string;
  branchId: string | null;
  serviceIds: string[];
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const { language } = useLanguage();
  const en = language === "en";
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [elegidos, setElegidos] = useState<string[]>(serviceIds);
  const [bloques, setBloques] = useState<Bloque[]>([]);
  const [ausencias, setAusencias] = useState<Ausencia[]>([]);
  const [nueva, setNueva] = useState({ startsAt: "", endsAt: "", reason: "" });
  const [guardando, setGuardando] = useState<string | null>(null);

  useEffect(() => {
    void pedir<{ services: Servicio[] }>("/api/business/services").then((d) => setServicios(d.services ?? []));
    void pedir<{ blocks: Bloque[] }>(`/api/business/stylists/schedule?stylistId=${stylistId}`).then((d) => setBloques(d.blocks));
    void pedir<{ absences: Ausencia[] }>(`/api/business/stylists/absences?stylistId=${stylistId}`).then((d) => setAusencias(d.absences));
  }, [stylistId]);

  const avisar = (ok: boolean, mensaje: string) =>
    showToast({ type: ok ? "success" : "error", title: ok ? (en ? "Saved" : "Guardado") : en ? "Could not save" : "No se pudo guardar", message: mensaje });

  async function guardar(que: string, accion: () => Promise<unknown>, exito: string) {
    setGuardando(que);
    try {
      await accion();
      avisar(true, exito);
      onSaved();
    } catch (error) {
      avisar(false, error instanceof Error ? error.message : "");
    } finally {
      setGuardando(null);
    }
  }

  // Servicios de la sucursal del estilista o de todo el negocio
  const disponibles = servicios.filter((s) => !s.branch_id || s.branch_id === branchId);
  const dias = DIAS[en ? "en" : "es"];

  return (
    <div className="mt-4 min-w-0 space-y-5 rounded-2xl border border-slate-200 bg-white p-4">
      <section>
        <h3 className="text-sm font-bold text-slate-800">{en ? "Services this stylist offers" : "Servicios que hace"}</h3>
        {disponibles.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">{en ? "Add services first." : "Primero da de alta servicios."}</p>
        ) : (
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {disponibles.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={elegidos.includes(s.id)}
                  onChange={() => setElegidos((e) => (e.includes(s.id) ? e.filter((x) => x !== s.id) : [...e, s.id]))}
                />
                {s.service_name}
              </label>
            ))}
          </div>
        )}
        <button
          type="button"
          disabled={guardando !== null}
          onClick={() =>
            void guardar("servicios", () => pedir("/api/business/stylists/services", { method: "PUT", body: JSON.stringify({ stylistId, serviceIds: elegidos }) }), en ? "Services updated." : "Servicios actualizados.")
          }
          className="mt-3 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {guardando === "servicios" ? (en ? "Saving..." : "Guardando...") : en ? "Save services" : "Guardar servicios"}
        </button>
      </section>

      <section>
        <h3 className="text-sm font-bold text-slate-800">{en ? "Weekly schedule" : "Horario semanal"}</h3>
        <p className="mt-1 text-xs text-slate-500">
          {en
            ? "Add one or more blocks per day. The break is the gap between blocks; a day without blocks is a day off."
            : "Agrega uno o más bloques por día. El descanso es el hueco entre bloques; un día sin bloques es día libre."}
        </p>
        <div className="mt-3 grid gap-2">
          {dias.map((nombre, dia) => (
            <div key={dia} className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
              <span className="w-24 shrink-0 text-sm font-semibold text-slate-700">{nombre}</span>
              {bloques.map((b, i) =>
                b.dayOfWeek !== dia ? null : (
                  <span key={i} className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-1 sm:flex sm:w-auto">
                    <input
                      type="time"
                      step={300}
                      value={b.start}
                      aria-label={`${nombre} ${en ? "start" : "inicio"}`}
                      onChange={(e) => setBloques((bs) => bs.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))}
                      className="h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-1.5 text-xs sm:w-auto sm:px-2 sm:text-sm"
                    />
                    <span className="text-slate-400">–</span>
                    <input
                      type="time"
                      step={300}
                      value={b.end}
                      aria-label={`${nombre} ${en ? "end" : "fin"}`}
                      onChange={(e) => setBloques((bs) => bs.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))}
                      className="h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-1.5 text-xs sm:w-auto sm:px-2 sm:text-sm"
                    />
                    <button
                      type="button"
                      aria-label={en ? "Remove block" : "Quitar bloque"}
                      onClick={() => setBloques((bs) => bs.filter((_, j) => j !== i))}
                      className="rounded px-1.5 text-red-600 hover:bg-red-50"
                    >
                      ×
                    </button>
                  </span>
                ),
              )}
              <button
                type="button"
                onClick={() => setBloques((bs) => [...bs, { dayOfWeek: dia, start: "10:00", end: "14:00" }])}
                className="rounded-lg border border-dashed border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 hover:border-emerald-400"
              >
                + {en ? "Block" : "Bloque"}
              </button>
              {!bloques.some((b) => b.dayOfWeek === dia) && <span className="text-xs text-slate-400">{en ? "Day off" : "Día libre"}</span>}
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={guardando !== null}
          onClick={() =>
            void guardar(
              "horario",
              async () => {
                const d = await pedir<{ blocks: Bloque[] }>("/api/business/stylists/schedule", { method: "PUT", body: JSON.stringify({ stylistId, blocks: bloques }) });
                setBloques(d.blocks);
              },
              en ? "Schedule updated." : "Horario actualizado.",
            )
          }
          className="mt-3 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {guardando === "horario" ? (en ? "Saving..." : "Guardando...") : en ? "Save schedule" : "Guardar horario"}
        </button>
      </section>

      <section>
        <h3 className="text-sm font-bold text-slate-800">{en ? "Time off" : "Ausencias"}</h3>
        <p className="mt-1 text-xs text-slate-500">
          {en ? "Vacation, appointments or any time off: clients can't book during it." : "Vacaciones, cita médica o cualquier rato en que no atiende: en ese tiempo no se le puede reservar."}
        </p>
        <ul className="mt-2 space-y-1.5">
          {ausencias.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span>
                {fechaHora.format(new Date(a.starts_at))} – {fechaHora.format(new Date(a.ends_at))}
                {a.reason ? <span className="text-slate-500"> · {a.reason}</span> : null}
              </span>
              <button
                type="button"
                onClick={() =>
                  void guardar(
                    "ausencia",
                    async () => {
                      await pedir("/api/business/stylists/absences", { method: "DELETE", body: JSON.stringify({ id: a.id }) });
                      setAusencias((xs) => xs.filter((x) => x.id !== a.id));
                    },
                    en ? "Time off removed." : "Ausencia quitada.",
                  )
                }
                className="text-xs font-semibold text-red-600 hover:underline"
              >
                {en ? "Remove" : "Quitar"}
              </button>
            </li>
          ))}
          {ausencias.length === 0 && <li className="text-sm text-slate-500">{en ? "No upcoming time off." : "Sin ausencias próximas."}</li>}
        </ul>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input type="datetime-local" step={300} value={nueva.startsAt} aria-label={en ? "From" : "Desde"} onChange={(e) => setNueva({ ...nueva, startsAt: e.target.value })} className="h-9 w-full min-w-0 rounded-lg border border-slate-200 px-2 text-sm" />
          <input type="datetime-local" step={300} value={nueva.endsAt} aria-label={en ? "Until" : "Hasta"} onChange={(e) => setNueva({ ...nueva, endsAt: e.target.value })} className="h-9 w-full min-w-0 rounded-lg border border-slate-200 px-2 text-sm" />
          <input value={nueva.reason} maxLength={120} placeholder={en ? "Reason (optional)" : "Motivo (opcional)"} onChange={(e) => setNueva({ ...nueva, reason: e.target.value })} className="h-9 w-full min-w-0 rounded-lg border border-slate-200 px-2 text-sm" />
          <button
            type="button"
            disabled={guardando !== null || !nueva.startsAt || !nueva.endsAt}
            onClick={() =>
              void guardar(
                "ausencia",
                async () => {
                  const d = await pedir<{ absence: Ausencia }>("/api/business/stylists/absences", { method: "POST", body: JSON.stringify({ stylistId, ...nueva }) });
                  setAusencias((xs) => [...xs, d.absence].sort((x, y) => x.starts_at.localeCompare(y.starts_at)));
                  setNueva({ startsAt: "", endsAt: "", reason: "" });
                },
                en ? "Time off added." : "Ausencia agregada.",
              )
            }
            className="h-9 rounded-lg bg-slate-800 px-3 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-60"
          >
            {en ? "Add" : "Agregar"}
          </button>
        </div>
      </section>
    </div>
  );
}
