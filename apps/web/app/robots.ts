import type { MetadataRoute } from "next";

import { NO_INDEXAR, SITIO } from "@/lib/sitio";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: NO_INDEXAR },
    sitemap: `${SITIO}/sitemap.xml`,
  };
}
