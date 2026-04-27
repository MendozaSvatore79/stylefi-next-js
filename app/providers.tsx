"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

import { ToastProvider } from "@/components/toast";
import { LanguageProvider } from "@/lib/language-context";
import OracleSupportWidget from "@/components/oracle-support-widget";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <LanguageProvider>
        <ToastProvider>
          {children}
          <OracleSupportWidget />
        </ToastProvider>
      </LanguageProvider>
    </SessionProvider>
  );
}
