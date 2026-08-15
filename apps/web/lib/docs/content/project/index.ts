import type { DocsPageView } from "@/lib/docs/content/page-view";
import { assetsPage } from "./assets";
import { compositionPage } from "./composition";
import { projectPage } from "./project";
import { timelinePage } from "./timeline";
import { validationPage } from "./validation";

export type ProjectSlug =
  | "project"
  | "timeline"
  | "composition"
  | "assets"
  | "validation";

export function isProjectSlug(slug: string): slug is ProjectSlug {
  return (
    slug === "project" ||
    slug === "timeline" ||
    slug === "composition" ||
    slug === "assets" ||
    slug === "validation"
  );
}

export function getProjectPage(slug: ProjectSlug): DocsPageView {
  switch (slug) {
    case "project":
      return projectPage();
    case "timeline":
      return timelinePage();
    case "composition":
      return compositionPage();
    case "assets":
      return assetsPage();
    case "validation":
      return validationPage();
  }
}
