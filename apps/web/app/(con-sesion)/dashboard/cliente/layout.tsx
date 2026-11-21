import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import ClientDashboardShell from "@/components/client-dashboard-shell";
import { accesoAlPanel } from "@/lib/sesion";

export default async function ClienteDashboardLayout({ children }: { children: ReactNode }) {
  const acceso = await accesoAlPanel("cliente");
  if ("redirigir" in acceso) redirect(acceso.redirigir);

  return <ClientDashboardShell>{children}</ClientDashboardShell>;
}
