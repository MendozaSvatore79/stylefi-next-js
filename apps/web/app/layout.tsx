import type { Metadata } from "next";

import { DESCRIPCION_SITIO, SITIO } from "@/lib/sitio";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { esMX } from "@clerk/localizations";
import "./globals.css";
import Providers from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITIO),
  title: "Stylehub Systems",
  description: DESCRIPCION_SITIO,
  // Vista previa al compartir el enlace en WhatsApp, redes, etc.
  openGraph: {
    type: "website",
    locale: "es_MX",
    url: SITIO,
    siteName: "STYLEHUB",
    title: "STYLEHUB",
    description: DESCRIPCION_SITIO,
    images: [{ url: "/brand/stylehub-app.png", width: 768, height: 768, alt: "STYLEHUB" }],
  },
  twitter: { card: "summary", title: "STYLEHUB", description: DESCRIPCION_SITIO, images: ["/brand/stylehub-app.png"] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      localization={esMX}
      signInUrl="/iniciar-sesion"
      signUpUrl="/register"
      // Todo inicio de sesión o registro pasa por /entrar (que decide: panel o /registro/completar), también cuando
      // Clerk cambia de flujo (Google desde /register con cuenta existente, o desde /iniciar-sesion con cuenta nueva).
      signInForceRedirectUrl="/entrar"
      signUpForceRedirectUrl="/entrar"
      afterSignOutUrl="/iniciar-sesion"
      telemetry={false}
    >
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
    </ClerkProvider>
  );
}
