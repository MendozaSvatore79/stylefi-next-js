import type { Metadata } from "next";

import { LegalPageLayout } from "@/components/legal-page-layout";

export const metadata: Metadata = {
  title: "Términos de servicio | STYLEHUB",
  description: "Condiciones generales para utilizar la plataforma STYLEHUB.",
};

export default function TermsOfServicePage() {
  return (
    <LegalPageLayout
      eyebrow="Información legal"
      title="Términos de servicio"
      description="Estas condiciones regulan el acceso y uso de STYLEHUB, las reservas realizadas por clientes y la administración de negocios dentro de la plataforma."
      accent="blue"
      alternateHref="/privacy-policy"
      alternateLabel="Consultar privacidad"
      sections={[
        {
          id: "aceptacion",
          title: "Aceptación de los términos",
          content: (
            <>
              <p>
                Al crear una cuenta o utilizar STYLEHUB, aceptas estos Términos de servicio y las reglas aplicables a la plataforma. Si no estás de acuerdo con alguna condición, no debes utilizar el servicio.
              </p>
              <p>
                Estos términos se aplican a clientes, negocios, administradores y demás personas que accedan a las funciones de STYLEHUB.
              </p>
            </>
          ),
        },
        {
          id: "uso",
          title: "Uso de la plataforma",
          content: (
            <>
              <p>
                STYLEHUB permite descubrir negocios de belleza, reservar citas y gestionar la actividad relacionada con servicios y horarios. Los usuarios de negocios pueden administrar sucursales, servicios, estilistas y miembros de su equipo.
              </p>
              <p>
                Te comprometes a proporcionar información veraz, proteger las credenciales de tu cuenta y utilizar la plataforma únicamente para fines legales.
              </p>
            </>
          ),
        },
        {
          id: "reservas",
          title: "Reservas y cancelaciones",
          content: (
            <>
              <p>
                Una reserva estará sujeta a la disponibilidad confirmada por el negocio correspondiente. Los horarios y la confirmación deben revisarse antes de acudir al establecimiento.
              </p>
              <p>
                Las condiciones de modificación, cancelación o ausencia pueden variar según el negocio y deberán ser comunicadas antes de confirmar la cita.
              </p>
            </>
          ),
        },
        {
          id: "cuentas",
          title: "Cuentas y contenido",
          content: (
            <>
              <p>
                Eres responsable de la actividad realizada desde tu cuenta y del contenido que publiques. Debes mantener actualizada la información de contacto y notificar cualquier uso no autorizado.
              </p>
              <p>
                No puedes suplantar identidades, distribuir contenido dañino, interferir con el funcionamiento del servicio ni intentar acceder a cuentas, sistemas o datos ajenos.
              </p>
            </>
          ),
        },
        {
          id: "disponibilidad",
          title: "Disponibilidad del servicio",
          content: (
            <>
              <p>
                Podemos actualizar, suspender o modificar funcionalidades para mejorar la seguridad, la estabilidad y el rendimiento de la plataforma.
              </p>
              <p>
                Procuramos mantener STYLEHUB disponible, pero no garantizamos un funcionamiento continuo, sin interrupciones ni libre de errores.
              </p>
            </>
          ),
        },
        {
          id: "pagos",
          title: "Pagos y servicios de terceros",
          content: (
            <>
              <p>
                Cuando una función incluya pagos o proveedores externos, cada operación estará sujeta a las condiciones y tarifas mostradas antes de completar el proceso.
              </p>
              <p>
                STYLEHUB puede integrar servicios de autenticación, infraestructura o procesamiento de pagos bajo sus propias condiciones y políticas de privacidad.
              </p>
            </>
          ),
        },
        {
          id: "responsabilidad",
          title: "Suspensión y responsabilidad",
          content: (
            <>
              <p>
                Podemos restringir o cancelar una cuenta que incumpla estos términos, represente un riesgo para otros usuarios o genere uso indebido de la plataforma.
              </p>
              <p>
                Dentro de los límites permitidos por la ley, STYLEHUB no será responsable por pérdidas indirectas derivadas del uso del servicio o de los servicios prestados por terceros.
              </p>
            </>
          ),
        },
        {
          id: "contacto",
          title: "Cambios y contacto",
          content: (
            <>
              <p>
                Podemos modificar estos términos para reflejar cambios en el servicio o requisitos legales. Cuando una modificación sea relevante, procuraremos comunicarla mediante la plataforma.
              </p>
              <p>
                Para solicitar información sobre estos términos o reportar un problema, utiliza los canales de soporte disponibles dentro de tu cuenta o en STYLEHUB.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
