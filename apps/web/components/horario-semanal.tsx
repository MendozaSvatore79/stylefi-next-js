"use client";

import { cambiarDia, copiarLunesAViernes, diasInvalidos, HORAS, nombreDelDia, type DiaHorario, type Idioma } from "@/lib/horario";

/**
 * Editor del horario semanal de una sucursal, sin modal: una fila por día con Abierto/Cerrado y dos selectores de
 * hora. Usa consultas de contenedor: el padre debe ser @container (los paneles de Sucursales lo son).
 */
export default function HorarioSemanal({
  valor,
  onChange,
  idioma,
}: {
  valor: DiaHorario[];
  onChange: (horario: DiaHorario[]) => void;
  idioma: Idioma;
}) {
  const en = idioma === "en";
  const invalidos = diasInvalidos(valor);
  const selector =
    "h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none ring-emerald-300 focus:ring disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400";

  return (
    <fieldset className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{en ? "Weekly hours" : "Horario semanal"}</legend>
      <div className="divide-y divide-slate-200">
        {valor.map((d) => {
          const nombre = nombreDelDia(d.dia, idioma);
          const malo = invalidos.includes(d.dia);
          return (
            <div key={d.dia} data-dia={d.dia} className="grid gap-2 py-2 @md:grid-cols-[minmax(0,9rem)_minmax(0,1fr)] @md:items-center">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-700">{nombre}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={d.abierto}
                  aria-label={`${nombre}: ${d.abierto ? (en ? "open" : "abierto") : en ? "closed" : "cerrado"}`}
                  onClick={() => onChange(cambiarDia(valor, d.dia, { abierto: !d.abierto }))}
                  className={`inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold transition ${
                    d.abierto ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                  }`}
                >
                  {d.abierto ? (en ? "Open" : "Abierto") : en ? "Closed" : "Cerrado"}
                </button>
              </div>
              <div className="grid gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <label className="min-w-0">
                    <span className="sr-only">{`${nombre}: ${en ? "opens" : "abre"}`}</span>
                    <select
                      value={d.abre ?? ""}
                      disabled={!d.abierto}
                      onChange={(event) => onChange(cambiarDia(valor, d.dia, { abre: event.target.value }))}
                      className={selector}
                      aria-invalid={malo}
                    >
                      {!d.abierto ? <option value="">—</option> : null}
                      {HORAS.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="min-w-0">
                    <span className="sr-only">{`${nombre}: ${en ? "closes" : "cierra"}`}</span>
                    <select
                      value={d.cierra ?? ""}
                      disabled={!d.abierto}
                      onChange={(event) => onChange(cambiarDia(valor, d.dia, { cierra: event.target.value }))}
                      className={selector}
                      aria-invalid={malo}
                    >
                      {!d.abierto ? <option value="">—</option> : null}
                      {HORAS.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {malo ? (
                  <p className="text-xs font-medium text-red-700">{en ? "Opening must be before closing." : "La apertura debe ser antes del cierre."}</p>
                ) : null}
                {d.dia === 0 ? (
                  <button
                    type="button"
                    onClick={() => onChange(copiarLunesAViernes(valor))}
                    className="justify-self-start rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
                  >
                    {en ? "Copy to Monday–Friday" : "Copiar a Lunes–Viernes"}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
