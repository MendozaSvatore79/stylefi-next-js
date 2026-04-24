import type { ReactNode } from "react";

import BusinessDashboardShell from "@/components/business-dashboard-shell";

export default function NegocioDashboardLayout({ children }: { children: ReactNode }) {
  return <BusinessDashboardShell>{children}</BusinessDashboardShell>;
}
