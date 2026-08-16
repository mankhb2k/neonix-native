import type { DocsPageView } from "@/lib/docs/content/page-view";
import { checklistPage } from "./checklist";
import { patternsPage } from "./patterns";
import { propertyPathsPage } from "./property-paths";
import { authoringRulesPage } from "./rules";

export type AiAuthoringSlug =
  | "ai/rules"
  | "ai/property-paths"
  | "ai/patterns"
  | "ai/checklist";

const SLUGS = new Set<string>([
  "ai/rules",
  "ai/property-paths",
  "ai/patterns",
  "ai/checklist",
]);

export function isAiAuthoringSlug(slug: string): slug is AiAuthoringSlug {
  return SLUGS.has(slug);
}

export function getAiAuthoringPage(slug: AiAuthoringSlug): DocsPageView {
  switch (slug) {
    case "ai/rules":
      return authoringRulesPage();
    case "ai/property-paths":
      return propertyPathsPage();
    case "ai/patterns":
      return patternsPage();
    case "ai/checklist":
      return checklistPage();
  }
}
