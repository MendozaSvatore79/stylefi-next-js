"use client";

import { useLanguage } from "@/lib/language-context";

/**
 * Aviso de un módulo desactivado o en mantenimiento. Va EN LUGAR del contenido: antes se ponía encima, pero el
 * formulario seguía debajo y se podía llegar a él con el teclado o haciendo scroll.
 */
export default function AvisoModulo({ titulo, razon }: { titulo?: string | null; razon: "disabled" | "maintenance" | null }) {
  const { t } = useLanguage();
  return (
    <div role="status" className="flex min-h-[60vh] items-center justify-center px-2">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{t("module.status")}</p>
        <h2 className="mt-2 text-3xl font-black text-[#151138]">{titulo || t("module.fallback")}</h2>
        <p className="mt-4 text-sm text-slate-600">{razon === "maintenance" ? t("module.maintenance") : t("module.disabled")}</p>
      </div>
    </div>
  );
}
