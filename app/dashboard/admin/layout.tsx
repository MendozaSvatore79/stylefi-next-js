import type { ReactNode } from "react";

import AdminDashboardShell from "@/components/admin-dashboard-shell";

export default function AdminDashboardLayout({ children }: { children: ReactNode }) {
  return <AdminDashboardShell>{children}</AdminDashboardShell>;
}
