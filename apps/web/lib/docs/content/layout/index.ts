import type { DocsPageView } from "@/lib/docs/content/page-view";
import { layoutAlignPage } from "./align";
import { layoutColumnPage } from "./column";
import { layoutGapPage } from "./gap";
import { layoutGridPage } from "./grid";
import { layoutJustifyPage } from "./justify";
import { layoutItemPage } from "./layout-item";
import { layoutOverviewPage } from "./overview";
import { layoutPaddingPage } from "./padding";
import { layoutRowPage } from "./row";

export type LayoutSlug =
  | "layout"
  | "layout/row"
  | "layout/column"
  | "layout/grid"
  | "layout/gap"
  | "layout/padding"
  | "layout/justify"
  | "layout/align"
  | "layout/layout-item";

const LAYOUT_SLUGS = new Set<string>([
  "layout",
  "layout/row",
  "layout/column",
  "layout/grid",
  "layout/gap",
  "layout/padding",
  "layout/justify",
  "layout/align",
  "layout/layout-item",
]);

export function isLayoutSlug(slug: string): slug is LayoutSlug {
  return LAYOUT_SLUGS.has(slug);
}

export function getLayoutPage(slug: LayoutSlug): DocsPageView {
  switch (slug) {
    case "layout":
      return layoutOverviewPage();
    case "layout/row":
      return layoutRowPage();
    case "layout/column":
      return layoutColumnPage();
    case "layout/grid":
      return layoutGridPage();
    case "layout/gap":
      return layoutGapPage();
    case "layout/padding":
      return layoutPaddingPage();
    case "layout/justify":
      return layoutJustifyPage();
    case "layout/align":
      return layoutAlignPage();
    case "layout/layout-item":
      return layoutItemPage();
  }
}
