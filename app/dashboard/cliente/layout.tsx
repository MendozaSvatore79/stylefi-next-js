import type { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import ClientDashboardShell from "@/components/client-dashboard-shell";
import { authConfig } from "@/lib/auth";

export default async function ClienteDashboardLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authConfig);

  if (!session?.user || session.user.accountType !== "cliente") {
    redirect("/iniciar-sesion?reason=unauthorized");
  }

  return <ClientDashboardShell>{children}</ClientDashboardShell>;
}
