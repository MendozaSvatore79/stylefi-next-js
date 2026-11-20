import type { Metadata } from "next";
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
  title: "Stylehub Systems",
  description: "Reserva citas en barberías y salones de belleza, y administra la agenda de tu negocio en un solo lugar.",
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
