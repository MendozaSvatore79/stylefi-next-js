import type { ReactNode } from "react";

import ClientDashboardShell from "@/components/client-dashboard-shell";

export default function ClienteDashboardLayout({ children }: { children: ReactNode }) {
  return <ClientDashboardShell>{children}</ClientDashboardShell>;
}
