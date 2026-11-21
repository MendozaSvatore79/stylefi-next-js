"use client";

import { useEffect } from "react";

import { useLanguage } from "@/lib/language-context";

/**
 * Mantiene <html lang> igual al idioma elegido, para que el lector de pantalla pronuncie con la voz correcta
 * (antes siempre decía "es"). Solo escribe en el DOM: no guarda estado.
 */
export default function IdiomaDelDocumento() {
  const { language } = useLanguage();
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return null;
}
