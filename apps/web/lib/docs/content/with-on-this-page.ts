import type { DocsPageView } from "@/lib/docs/content/page-view";

/**
 * Marks a page as eligible for the right "On this page" rail.
 * Pages can opt out by passing `showToc: false` in the view.
 */
export function withOnThisPage(page: DocsPageView): DocsPageView {
  return { ...page, showToc: page.showToc ?? true };
}
