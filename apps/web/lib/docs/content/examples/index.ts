import type { DocsPageView } from "@/lib/docs/content/page-view";
import { badgeExamplePage } from "./badge";
import { imageParallaxPage, textIntroPage } from "./fixtures";
import { examplesGalleryPage } from "./gallery";
import { invalidExamplesPage } from "./invalid";

export type ExamplesSlug =
  | "examples"
  | "examples/text-intro"
  | "examples/image-parallax"
  | "examples/badge"
  | "examples/invalid";

const SLUGS = new Set<string>([
  "examples",
  "examples/text-intro",
  "examples/image-parallax",
  "examples/badge",
  "examples/invalid",
]);

export function isExamplesSlug(slug: string): slug is ExamplesSlug {
  return SLUGS.has(slug);
}

export function getExamplesPage(slug: ExamplesSlug): DocsPageView {
  switch (slug) {
    case "examples":
      return examplesGalleryPage();
    case "examples/text-intro":
      return textIntroPage();
    case "examples/image-parallax":
      return imageParallaxPage();
    case "examples/badge":
      return badgeExamplePage();
    case "examples/invalid":
      return invalidExamplesPage();
  }
}
