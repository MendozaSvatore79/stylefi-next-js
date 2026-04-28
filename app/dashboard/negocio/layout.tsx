import type { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import BusinessDashboardShell from "@/components/business-dashboard-shell";
import { authConfig } from "@/lib/auth";

export default async function NegocioDashboardLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authConfig);

  if (!session?.user || session.user.accountType !== "negocio") {
    redirect("/iniciar-sesion?reason=unauthorized");
  }

  return <BusinessDashboardShell>{children}</BusinessDashboardShell>;
}
