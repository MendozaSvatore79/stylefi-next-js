import { Suspense } from "react";
import LoginClient from "./login-client";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-10">Cargando...</div>}>
      <LoginClient />
    </Suspense>
  );
}
