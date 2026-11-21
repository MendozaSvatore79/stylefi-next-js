"use client";

import { useState } from "react";
import { Settings2, ShieldCheck } from "lucide-react";

import AccountSecurityPanel from "@/components/account-security-panel";
import { useLanguage } from "@/lib/language-context";

export const dynamic = "force-dynamic";

export default function ClienteConfiguracionPage() {
  const { language, setLanguage, t } = useLanguage();
  const [activeSection, setActiveSection] = useState<"general" | "security">("general");

  const sections = [
    { id: "general", label: t("settings.general"), icon: Settings2, description: t("settings.general.desc") },
    { id: "security", label: t("settings.security"), icon: ShieldCheck, description: t("settings.security.desc") },
  ];

  return (
    <section className="space-y-6">
      <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Configuración</p>
        <h2 className="mt-2 text-2xl font-black text-[#151138]">{t("settings.title")}</h2>
        <p className="mt-3 max-w-2xl text-sm text-slate-600">{t("settings.description")}</p>

        <div className="mt-6 grid gap-3 grid-cols-2">
          {sections.map((section) => {
            const SectionIcon = section.icon;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id as typeof activeSection)}
                className={`group relative overflow-hidden rounded-2xl border-2 px-4 py-4 text-center transition-all ${
                  activeSection === section.id
                    ? "border-indigo-600 bg-indigo-50 shadow-md"
                    : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
                }`}
              >
                <div className={`mx-auto flex h-10 w-10 items-center justify-center rounded-2xl ${activeSection === section.id ? "bg-indigo-600 text-white" : "bg-white text-slate-700"}`}>
                  <SectionIcon className="size-5" />
                </div>
                <p className={`mt-2 text-sm font-semibold transition ${activeSection === section.id ? "text-indigo-700" : "text-slate-700 group-hover:text-slate-900"}`}>
                  {section.label}
                </p>
                <p className={`mt-1 text-xs transition ${activeSection === section.id ? "text-indigo-600" : "text-slate-500"}`}>
                  {section.description}
                </p>
              </button>
            );
          })}
        </div>
      </article>

      {activeSection === "general" ? (
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-indigo-600">
              <Settings2 className="size-8" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">General</p>
              <h3 className="mt-2 text-xl font-black text-[#151138]">{t("settings.general")}</h3>
              <p className="mt-2 text-sm text-slate-600">Configura opciones generales de tu perfil, como idioma, zona horaria y preferencias de experiencia.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <label htmlFor="ajustes-idioma" className="block text-sm font-semibold text-slate-700">{t("general.language")}</label>
              <select id="ajustes-idioma"
                value={language}
                onChange={(e) => setLanguage(e.target.value as "es" | "en")}
                className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none ring-indigo-300 focus:ring"
              >
                <option value="es">{t("general.language.es")}</option>
                <option value="en">{t("general.language.en")}</option>
              </select>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <label htmlFor="ajustes-zona" className="block text-sm font-semibold text-slate-700">{t("general.timezone")}</label>
              <select id="ajustes-zona" className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none ring-indigo-300 focus:ring">
                <option>{t("general.timezone.mx")}</option>
              </select>
            </div>
          </div>
        </article>
      ) : null}

      {activeSection === "security" ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
              <ShieldCheck className="size-8" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Seguridad</p>
              <h3 className="mt-2 text-xl font-black text-[#151138]">{t("security.title")}</h3>
              <p className="mt-2 text-sm text-slate-600">{t("security.description")}</p>
            </div>
          </div>
          <AccountSecurityPanel title="" />
        </div>
      ) : null}

    </section>
  );
}
