import { redirect } from "next/navigation";

import { estadoDeRegistro, inicioPorTipo } from "@/lib/sesion";

import CompletarRegistro from "./completar-registro";

/** Quien entró con Clerk y aún no tiene cuenta en StyleFi elige cliente o negocio y completa sus datos. */
export default async function CompletarRegistroPage() {
  const estado = await estadoDeRegistro();
  if (estado.estado === "sin-sesion") redirect("/iniciar-sesion");
  if (estado.estado === "baneada") redirect("/cuenta-suspendida");
  if (estado.estado === "lista") redirect(inicioPorTipo(estado.accountType));
  return (
    <CompletarRegistro
      correo={estado.clerk.correoVerificado}
      nombre={estado.clerk.nombre ?? ""}
      apellido={estado.clerk.apellido ?? ""}
    />
  );
}
