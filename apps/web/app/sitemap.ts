import { statSync } from "node:fs";
import path from "node:path";
import type { MetadataRoute } from "next";
import { DOCS_PAGE_SLUGS, getDocsLastModified } from "@/lib/docs/docs";

const SITE_URL = "https://www.neonix.video";

// The last time each static route's own source file changed on disk, so the
// sitemap reports a real modification signal instead of "now" on every request.
const STATIC_ROUTE_SOURCES: Record<string, string> = {
  "/": "app/(marketing)/page.tsx",
  "/html-to-video": "app/(marketing)/html-to-video/page.tsx",
  "/overview": "app/(marketing)/overview/page.tsx",
  "/privacy": "app/(marketing)/privacy/page.tsx",
  "/terms": "app/(marketing)/terms/page.tsx",
  "/support": "app/(marketing)/support/page.tsx",
  "/playground": "app/playground/page.tsx",
};

function docsPath(slug: string): string {
  return slug === "" ? "/docs" : `/docs/${slug}`;
}

function mtimeOf(filePath: string, fallback: Date): Date {
  try {
    return statSync(filePath).mtime;
  } catch {
    return fallback;
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const buildTime = new Date();
  const staticRoutes = Object.entries(STATIC_ROUTE_SOURCES).map(([route, relativePath]) => ({
    path: route,
    lastModified: mtimeOf(path.join(process.cwd(), relativePath), buildTime),
  }));
  const docsRoutes = DOCS_PAGE_SLUGS.map((slug) => ({
    path: docsPath(slug),
    lastModified: getDocsLastModified(slug) ?? buildTime,
  }));

  const routes = new Map([...staticRoutes, ...docsRoutes].map((route) => [route.path, route]));

  return Array.from(routes.values()).map(({ path: routePath, lastModified }) => ({
    url: `${SITE_URL}${routePath}`,
    lastModified,
    changeFrequency: routePath === "/" ? "weekly" : "monthly",
    priority:
      routePath === "/"
        ? 1
        : routePath === "/html-to-video" || routePath === "/overview"
          ? 0.9
          : 0.6,
  }));
}
