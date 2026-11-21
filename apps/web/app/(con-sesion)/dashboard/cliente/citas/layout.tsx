import { Suspense } from "react";
import type { ReactNode } from "react";

export default function CitasLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div>Cargando...</div>}>{children}</Suspense>;
}
