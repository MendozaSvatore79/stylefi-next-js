"use client";

import type { ReactNode } from "react";

import { ToastProvider } from "@/components/toast";
import { LanguageProvider } from "@/lib/language-context";
import { SesionProvider } from "@/lib/sesion-cliente";
import IdiomaDelDocumento from "@/components/idioma-del-documento";
import OracleSupportWidget from "@/components/oracle-support-widget";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SesionProvider>
      <LanguageProvider>
        <IdiomaDelDocumento />
        <ToastProvider>
          {children}
          <OracleSupportWidget />
        </ToastProvider>
      </LanguageProvider>
    </SesionProvider>
  );
}
