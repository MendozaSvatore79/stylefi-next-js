import { SignUp } from "@clerk/nextjs";

import MarcoAcceso from "@/components/marco-acceso";

export default function RegistroPage() {
  return (
    <MarcoAcceso>
      <SignUp routing="path" path="/register" signInUrl="/iniciar-sesion" forceRedirectUrl="/entrar" />
    </MarcoAcceso>
  );
}
