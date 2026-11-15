"use client";

import { useState } from "react";

/**
 * Servicio o estilista sin sucursal (quedan así al borrar su sucursal: ON DELETE SET NULL). Regla de producto: cada
 * uno pertenece a una sucursal; sin ella el catálogo no lo muestra y no se puede reservar. Aviso ámbar y selector en
 * línea para asignarle una.
 */
export default function AsignarSucursal({
  sucursales,
  idioma,
  onAsignar,
}: {
  sucursales: Array<{ id: string; branch_name: string }>;
  idioma: "es" | "en";
  /** Guarda y avisa (toast) el resultado; no debe lanzar. */
  onAsignar: (branchId: string) => Promise<void>;
}) {
  const en = idioma === "en";
  const [elegida, setElegida] = useState("");
  const [guardando, setGuardando] = useState(false);

  return (
    <div data-sin-sucursal className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5">
      <p className="text-xs font-semibold text-amber-800">
        {en ? "⚠ No branch: not visible to clients" : "⚠ Sin sucursal: no visible para clientes"}
      </p>
      {sucursales.length === 0 ? (
        <p className="mt-1 text-xs text-amber-800">{en ? "Register a branch first to assign it." : "Primero registra una sucursal para asignársela."}</p>
      ) : (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <label className="min-w-0 flex-1">
            <span className="sr-only">{en ? "Branch" : "Sucursal"}</span>
            <select
              value={elegida}
              onChange={(event) => setElegida(event.target.value)}
              disabled={guardando}
              className="h-9 w-full min-w-0 rounded-lg border border-amber-300 bg-white px-2 text-xs outline-none ring-amber-300 focus:ring"
            >
              <option value="">{en ? "Choose a branch" : "Elige una sucursal"}</option>
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.branch_name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!elegida || guardando}
            onClick={async () => {
              setGuardando(true);
              try {
                await onAsignar(elegida);
              } finally {
                setGuardando(false);
              }
            }}
            className="h-9 rounded-lg bg-amber-600 px-3 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {guardando ? (en ? "Assigning..." : "Asignando...") : en ? "Assign branch" : "Asignar sucursal"}
          </button>
        </div>
      )}
    </div>
  );
}
