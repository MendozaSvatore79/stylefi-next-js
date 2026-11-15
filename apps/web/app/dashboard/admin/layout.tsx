import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import AdminDashboardShell from "@/components/admin-dashboard-shell";
import { accesoAlPanel } from "@/lib/sesion";

/**
 * Redirige a quien no es administrador. Es solo para la experiencia: el layout no se vuelve a
 * evaluar en cada navegación, así que la protección real de los datos está en requireAdmin()
 * dentro de cada ruta de app/api/admin/.
 */
export default async function AdminDashboardLayout({ children }: { children: ReactNode }) {
  const acceso = await accesoAlPanel("admin");
  if ("redirigir" in acceso) redirect(acceso.redirigir);

  return <AdminDashboardShell>{children}</AdminDashboardShell>;
}
