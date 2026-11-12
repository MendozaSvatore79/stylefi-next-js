import type { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import AdminDashboardShell from "@/components/admin-dashboard-shell";
import { authConfig } from "@/lib/auth";

/**
 * Redirige a quien no es administrador. Es solo para la experiencia: el layout no se vuelve a
 * evaluar en cada navegación, así que la protección real de los datos está en requireAdmin()
 * dentro de cada ruta de app/api/admin/.
 */
export default async function AdminDashboardLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authConfig);

  if (!session?.user || session.user.accountType !== "admin") {
    redirect("/iniciar-sesion?reason=unauthorized");
  }

  return <AdminDashboardShell>{children}</AdminDashboardShell>;
}
