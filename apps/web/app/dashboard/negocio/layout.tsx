import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import BusinessDashboardShell from "@/components/business-dashboard-shell";
import { accesoAlPanel } from "@/lib/sesion";

export default async function NegocioDashboardLayout({ children }: { children: ReactNode }) {
  const acceso = await accesoAlPanel("negocio");
  if ("redirigir" in acceso) redirect(acceso.redirigir);

  return <BusinessDashboardShell>{children}</BusinessDashboardShell>;
}
