import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Etiqueta visible para un campo de formulario. Envuelve el control en un <label>, así queda ligado sin ids y el
 * lector de pantalla lo anuncia. El placeholder solo no basta: desaparece al escribir (revisión 4, 2026-11-20).
 */
export default function Campo({ etiqueta, className, children }: { etiqueta: ReactNode; className?: string; children: ReactNode }) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="mb-1 block text-xs font-semibold text-slate-600">{etiqueta}</span>
      {children}
    </label>
  );
}
