"use client";

import OracleSupportWidget from "@/components/oracle-support-widget";
import { SesionAnonima } from "@/lib/sesion-contexto";

/** AURA en la portada, que no carga Clerk: la visita escribe como visitante (nombre y correo). */
export default function AuraSinSesion() {
  return (
    <SesionAnonima>
      <OracleSupportWidget />
    </SesionAnonima>
  );
}
