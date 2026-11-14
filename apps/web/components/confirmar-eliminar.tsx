"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * Confirmación en línea antes de eliminar (decisión de producto, 2026-11-14): sin modal ni window.confirm. Se pone
 * dentro de la tarjeta; el foco va a «Cancelar» y Escape también cancela, para que un Enter de más no borre nada.
 */
export default function ConfirmarEliminar({
  nombre,
  aviso,
  idioma,
  onCancelar,
  onConfirmar,
}: {
  nombre: string;
  /** Lo que arrastra el borrado (por ejemplo, servicios que quedan sin sucursal). */
  aviso?: ReactNode;
  idioma: "es" | "en";
  onCancelar: () => void;
  /**
   * Borra; si no se pudo devuelve el mensaje (por ejemplo, el 409 «tiene N citas próximas»), que se muestra aquí
   * mismo y la confirmación queda abierta. Si se pudo, el padre la cierra.
   */
  onConfirmar: () => Promise<string | void>;
}) {
  const en = idioma === "en";
  const cancelar = useRef<HTMLButtonElement>(null);
  const titulo = useId();
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cancelar.current?.focus();
  }, []);

  return (
    <div
      role="group"
      aria-labelledby={titulo}
      data-confirmar-eliminar
      onKeyDown={(event) => {
        if (event.key === "Escape" && !eliminando) onCancelar();
      }}
      className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3"
    >
      <p id={titulo} className="text-sm font-semibold wrap-break-word text-red-800">
        {en ? `Delete “${nombre}”?` : `¿Eliminar «${nombre}»?`}
      </p>
      {aviso ? <div className="mt-1 text-xs text-red-700">{aviso}</div> : null}
      {error ? (
        <p role="alert" className="mt-2 rounded-lg bg-white px-2 py-1.5 text-xs font-semibold text-red-800">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          ref={cancelar}
          type="button"
          onClick={onCancelar}
          disabled={eliminando}
          className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-70"
        >
          {en ? "Cancel" : "Cancelar"}
        </button>
        <button
          type="button"
          onClick={async () => {
            setEliminando(true);
            setError(null);
            try {
              const mensaje = await onConfirmar();
              if (mensaje) setError(mensaje);
            } finally {
              setEliminando(false);
            }
          }}
          disabled={eliminando}
          className="h-9 rounded-lg bg-red-600 px-4 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {eliminando ? (en ? "Deleting..." : "Eliminando...") : en ? "Yes, delete" : "Sí, eliminar"}
        </button>
      </div>
    </div>
  );
}
