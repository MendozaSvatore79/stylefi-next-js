"use client"; // Las pantallas de error de Next son componentes de cliente

import { codigoDeError, TEXTO_ERROR } from "@/lib/pagina-error";

/**
 * Error en el layout raíz: reemplaza todo el documento, así que lleva su propio <html> y estilos en línea (los
 * estilos globales no se cargan aquí).
 */
export default function ErrorGlobal({ error, retry }: { error: unknown; retry: () => void }) {
  const codigo = codigoDeError(error);
  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f8fafc", color: "#0f172a" }}>
        <title>{`${TEXTO_ERROR.titulo} · Stylehub`}</title>
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: "40px 16px",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.3em", margin: 0 }}>STYLEHUB</p>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>{TEXTO_ERROR.titulo}</h1>
          <p role="alert" style={{ maxWidth: 448, fontSize: 14, color: "#475569", margin: 0 }}>
            {TEXTO_ERROR.detalle}
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ border: 0, borderRadius: 8, background: "#0f172a", color: "#fff", padding: "8px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            {TEXTO_ERROR.reintentar}
          </button>
          {codigo ? <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>Código: {codigo}</p> : null}
        </main>
      </body>
    </html>
  );
}
