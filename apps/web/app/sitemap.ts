import type { MetadataRoute } from "next";

import { PAGINAS_PUBLICAS, SITIO } from "@/lib/sitio";

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGINAS_PUBLICAS.map((ruta) => ({
    url: ruta === "/" ? SITIO : `${SITIO}${ruta}`,
    changeFrequency: ruta === "/" ? "weekly" : "monthly",
    priority: ruta === "/" ? 1 : 0.5,
  }));
}
