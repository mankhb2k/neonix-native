import type { DocsPageView } from "@/lib/docs/content/page-view";
import { audioFadePage } from "./audio-fade";
import { easingPage } from "./easing";
import { keyframesPage } from "./keyframes";
import { animationTimingPage } from "./timing";

export type AnimationSlug =
  | "motion"
  | "animation/timing"
  | "animation/keyframes"
  | "animation/easing"
  | "animation/audio-fade";

const SLUGS = new Set<string>([
  "motion",
  "animation/timing",
  "animation/keyframes",
  "animation/easing",
  "animation/audio-fade",
]);

export function isAnimationSlug(slug: string): slug is AnimationSlug {
  return SLUGS.has(slug);
}

export function getAnimationPage(slug: AnimationSlug): DocsPageView {
  switch (slug) {
    case "motion":
    case "animation/keyframes":
      return keyframesPage();
    case "animation/timing":
      return animationTimingPage();
    case "animation/easing":
      return easingPage();
    case "animation/audio-fade":
      return audioFadePage();
  }
}
