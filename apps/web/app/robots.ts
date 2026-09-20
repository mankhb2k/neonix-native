import type { MetadataRoute } from "next";

const SITE_URL = "https://www.neonix.video";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/app/",
          "/dashboard/",
          "/oauth",
          "/approve-ui",
          "/playground",
          "/preview/",
          "/docs/preview",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
