"use client";

import type { ReactNode } from "react";

import OracleSupportWidget from "@/components/oracle-support-widget";
import { marcarPaginaConClerk } from "@/lib/api";
import { SesionProvider } from "@/lib/sesion-cliente";

/**
 * Parte del navegador del grupo con sesión. La marca se pone al dibujar, antes de que corran los efectos de las
 * pantallas: así api() sabe que aquí sí hay Clerk y espera su token (en la portada no lo espera).
 */
export default function ConSesion({ children }: { children: ReactNode }) {
  marcarPaginaConClerk();
  return (
    <SesionProvider>
      {children}
      <OracleSupportWidget />
    </SesionProvider>
  );
}
