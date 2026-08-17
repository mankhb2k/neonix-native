import type { DocsPageView } from "@/lib/docs/content/page-view";
import { blurPage } from "./blur";
import { colorAdjustPage } from "./color-adjust";
import { glowPage } from "./glow";
import { innerGlowPage } from "./inner-glow";
import { noisePage } from "./noise";
import { effectsOverviewPage } from "./overview";
import { shadowPage } from "./shadow";

export type EffectsSlug =
  | "effects"
  | "effects/blur"
  | "effects/shadow"
  | "effects/glow"
  | "effects/inner-glow"
  | "effects/noise"
  | "effects/color-adjust";

const SLUGS = new Set<string>([
  "effects",
  "effects/blur",
  "effects/shadow",
  "effects/glow",
  "effects/inner-glow",
  "effects/noise",
  "effects/color-adjust",
]);

export function isEffectsSlug(slug: string): slug is EffectsSlug {
  return SLUGS.has(slug);
}

export function getEffectsPage(slug: EffectsSlug): DocsPageView {
  switch (slug) {
    case "effects":
      return effectsOverviewPage();
    case "effects/blur":
      return blurPage();
    case "effects/shadow":
      return shadowPage();
    case "effects/glow":
      return glowPage();
    case "effects/inner-glow":
      return innerGlowPage();
    case "effects/noise":
      return noisePage();
    case "effects/color-adjust":
      return colorAdjustPage();
  }
}
