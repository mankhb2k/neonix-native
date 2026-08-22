import { getV2DocsPage } from "@/lib/docs/content/v2";
import type { DocsPageView } from "@/lib/docs/content/page-view";

export type { DocsPageView };

/** Public documentation is static V2 teaching content only. */
export function getDocsPage(slug: string): DocsPageView {
  const page = getV2DocsPage(slug);
  if (!page) {
    throw new Error(`Unknown published documentation slug: ${slug}`);
  }
  return page;
}
