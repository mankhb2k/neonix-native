import type { DocsPageView } from "@/lib/docs/content/page-view";
import { blendModePage } from "./blend-mode";
import { maskPage } from "./mask";
import { opacityPage } from "./opacity";
import { visiblePage } from "./visible";

export type AppearanceSlug =
  | "appearance"
  | "appearance/visible"
  | "appearance/opacity"
  | "compositing/blend-mode"
  | "compositing/mask";

const SLUGS = new Set<string>([
  "appearance",
  "appearance/visible",
  "appearance/opacity",
  "compositing/blend-mode",
  "compositing/mask",
]);

export function isAppearanceSlug(slug: string): slug is AppearanceSlug {
  return SLUGS.has(slug);
}

export function getAppearancePage(slug: AppearanceSlug): DocsPageView {
  switch (slug) {
    case "appearance":
    case "appearance/opacity":
      return opacityPage();
    case "appearance/visible":
      return visiblePage();
    case "compositing/blend-mode":
      return blendModePage();
    case "compositing/mask":
      return maskPage();
  }
}
