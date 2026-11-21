"use client";

import type { ReactNode } from "react";

import IdiomaDelDocumento from "@/components/idioma-del-documento";
import { ToastProvider } from "@/components/toast";
import { LanguageProvider } from "@/lib/language-context";

/** Proveedores de todas las páginas. Clerk, la sesión y AURA con sesión van en app/(con-sesion)/layout.tsx. */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <IdiomaDelDocumento />
      <ToastProvider>{children}</ToastProvider>
    </LanguageProvider>
  );
}
