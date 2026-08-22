import {
  getAiAuthoringPage,
  isAiAuthoringSlug,
} from "@/lib/docs/content/ai-authoring";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { stubPage } from "@/lib/docs/content/stub";
import { navLabelForSlug } from "@/lib/docs/nav";

export type { DocsPageView };

/** The V2 guide surface intentionally exposes only the active architecture. */
export function getDocsPage(slug: string): DocsPageView {
  if (slug === "" || slug === "ai" || isAiAuthoringSlug(slug)) {
    return getAiAuthoringPage();
  }
  return stubPage(navLabelForSlug(slug) ?? slug);
}
