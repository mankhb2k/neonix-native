import type { DocsPageView } from "@/lib/docs/content/page-view";

export function withOnThisPage(page: DocsPageView): DocsPageView {
  return { ...page, showToc: true };
}
