import type { Metadata } from "next";

import { LegalPageLayout } from "@/components/legal-page-layout";

export const metadata: Metadata = {
  title: "Política de privacidad | STYLEHUB",
  description: "Información sobre cómo STYLEHUB utiliza y protege los datos personales.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      eyebrow="Protección de datos"
      title="Política de privacidad"
      description="Conoce qué información recopilamos, cómo la utilizamos y qué opciones tienes para revisar, actualizar o eliminar tus datos."
      accent="red"
      alternateHref="/terms-of-service"
      alternateLabel="Consultar términos"
      sections={[
        {
          id: "informacion",
          title: "Información que recopilamos",
          content: (
            <>
              <p>
                Podemos recopilar datos de cuenta, como nombre, correo electrónico e información de perfil; datos necesarios para procesar reservas; información del negocio y datos técnicos básicos utilizados para operar y proteger la plataforma.
              </p>
              <p>
                Solo solicitamos información necesaria para proporcionar las funciones que utilizas y administrar tu relación con el negocio o con STYLEHUB.
              </p>
            </>
          ),
        },
        {
          id: "uso",
          title: "Cómo utilizamos la información",
          content: (
            <ul className="grid gap-3 sm:grid-cols-2">
              {[
                "Crear y administrar cuentas.",
                "Procesar reservas y citas.",
                "Facilitar la comunicación con los negocios.",
                "Mostrar servicios y disponibilidad.",
                "Prevenir fraude y accesos no autorizados.",
                "Mantener y mejorar el servicio.",
              ].map((item) => (
                <li key={item} className="rounded-2xl border border-blue-950/8 bg-[#eef2ff]/70 p-4">
                  <span className="mr-2 text-red-500">•</span>{item}
                </li>
              ))}
            </ul>
          ),
        },
        {
          id: "comparticion",
          title: "Compartición de datos",
          content: (
            <>
              <p>
                Compartimos únicamente la información necesaria para prestar el servicio. Esto puede incluir datos de una reserva con el negocio seleccionado y datos procesados por proveedores de autenticación, infraestructura, pagos o mensajería.
              </p>
              <p>
                No vendemos datos personales. Podemos divulgar información cuando exista una obligación legal, una petición válida de autoridades o una necesidad legítima de proteger a las personas y a la plataforma.
              </p>
            </>
          ),
        },
        {
          id: "conservacion",
          title: "Conservación y seguridad",
          content: (
            <>
              <p>
                Conservamos los datos durante el tiempo necesario para proporcionar el servicio, cumplir obligaciones legales y resolver disputas.
              </p>
              <p>
                Aplicamos medidas técnicas y organizativas razonables para reducir accesos no autorizados, alteraciones, pérdidas o divulgaciones de información.
              </p>
            </>
          ),
        },
        {
          id: "derechos",
          title: "Tus opciones y derechos",
          content: (
            <>
              <p>
                Puedes revisar y actualizar ciertos datos desde tu cuenta. También puedes solicitar acceso, corrección o eliminación de información personal cuando corresponda.
              </p>
              <p>
                Algunas solicitudes pueden estar sujetas a obligaciones legales o a la necesidad de conservar determinados registros para operar, prevenir fraude o resolver disputas.
              </p>
            </>
          ),
        },
        {
          id: "cookies",
          title: "Cookies y tecnologías similares",
          content: (
            <>
              <p>
                Podemos utilizar cookies o tecnologías equivalentes para mantener la sesión, recordar preferencias y comprender el rendimiento general de la plataforma.
              </p>
              <p>
                Puedes administrar las cookies desde la configuración de tu navegador. Algunas funciones podrían verse afectadas si deshabilitas tecnologías necesarias para la autenticación.
              </p>
            </>
          ),
        },
        {
          id: "terceros",
          title: "Servicios de terceros",
          content: (
            <>
              <p>
                Algunos proveedores procesan datos conforme a sus propias políticas. Esto puede incluir servicios de autenticación, alojamiento, almacenamiento de archivos, procesamiento de pagos y mensajería.
              </p>
              <p>
                Te recomendamos revisar las políticas de los proveedores que utilices cuando interactúes directamente con sus servicios.
              </p>
            </>
          ),
        },
        {
          id: "cambios",
          title: "Cambios y contacto",
          content: (
            <>
              <p>
                Podemos actualizar esta política para reflejar cambios en el servicio o en los requisitos legales. La fecha de actualización siempre aparecerá en esta página.
              </p>
              <p>
                Para ejercer tus derechos o realizar una consulta sobre privacidad, utiliza los canales de soporte disponibles dentro de tu cuenta o en STYLEHUB.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
