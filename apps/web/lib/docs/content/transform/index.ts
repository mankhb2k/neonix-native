import type { DocsPageView } from "@/lib/docs/content/page-view";
import { depthPage } from "./depth";
import { originPage } from "./origin";
import { transformOverviewPage } from "./overview";
import { rotatePage } from "./rotate";
import { scalePage } from "./scale";
import { skewPage } from "./skew";
import { translatePage } from "./translate";

export type TransformSlug =
  | "transform"
  | "transform/translate"
  | "transform/depth"
  | "transform/rotate"
  | "transform/scale"
  | "transform/skew"
  | "transform/origin";

const SLUGS = new Set<string>([
  "transform",
  "transform/translate",
  "transform/depth",
  "transform/rotate",
  "transform/scale",
  "transform/skew",
  "transform/origin",
]);

export function isTransformSlug(slug: string): slug is TransformSlug {
  return SLUGS.has(slug);
}

export function getTransformPage(slug: TransformSlug): DocsPageView {
  switch (slug) {
    case "transform":
      return transformOverviewPage();
    case "transform/translate":
      return translatePage();
    case "transform/depth":
      return depthPage();
    case "transform/rotate":
      return rotatePage();
    case "transform/scale":
      return scalePage();
    case "transform/skew":
      return skewPage();
    case "transform/origin":
      return originPage();
  }
}
