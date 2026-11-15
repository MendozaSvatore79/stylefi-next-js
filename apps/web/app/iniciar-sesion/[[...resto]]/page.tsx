import { SignIn } from "@clerk/nextjs";

import MarcoAcceso from "@/components/marco-acceso";

export default async function IniciarSesionPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  return (
    <MarcoAcceso aviso={reason}>
      <SignIn routing="path" path="/iniciar-sesion" signUpUrl="/register" forceRedirectUrl="/entrar" />
    </MarcoAcceso>
  );
}
