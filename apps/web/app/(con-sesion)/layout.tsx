import { ClerkProvider } from "@clerk/nextjs";
import { localizacionClerk } from "@/lib/sesion-localizacion";

import ConSesion from "./con-sesion";

/**
 * Clerk solo en las páginas que lo usan (paneles, entrar, registro, inicio de sesión, cuenta suspendida): la portada,
 * términos y privacidad ya no descargan sus scripts (~400 KB). Un solo grupo, para no volver a montar Clerk al pasar
 * del inicio de sesión al panel.
 */
export default function LayoutConSesion({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      localization={localizacionClerk}
      signInUrl="/iniciar-sesion"
      signUpUrl="/register"
      // Todo inicio de sesión o registro pasa por /entrar (que decide: panel o /registro/completar), también cuando
      // Clerk cambia de flujo (Google desde /register con cuenta existente, o desde /iniciar-sesion con cuenta nueva).
      signInForceRedirectUrl="/entrar"
      signUpForceRedirectUrl="/entrar"
      afterSignOutUrl="/iniciar-sesion"
      telemetry={false}
    >
      <ConSesion>{children}</ConSesion>
    </ClerkProvider>
  );
}
