import type { MetadataRoute } from "next";
import { DOCS_PAGE_SLUGS } from "@/lib/docs/docs";

const SITE_URL = "https://neonix.video";

const STATIC_ROUTES = [
  "/",
  "/privacy",
  "/terms",
  "/support",
  "/docs/mcp",
  "/docs/mcp/claude",
  "/docs/mcp/chatgpt",
  "/docs/mcp/grok",
];

function docsPath(slug: string): string {
  return slug === "" ? "/docs" : `/docs/${slug}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const docsRoutes = DOCS_PAGE_SLUGS.map(docsPath);
  const routes = Array.from(new Set([...STATIC_ROUTES, ...docsRoutes]));

  return routes.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.6,
  }));
}
