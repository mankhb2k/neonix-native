import type { DocsPageView } from "@/lib/docs/content/page-view";
import { getAiAuthoringPage } from "@/lib/docs/content/ai-authoring";
import { howAVideoIsDescribedPage } from "./how-a-video-is-described";
import { minimalProjectPage } from "./minimal-project";
import { whatIsMotionJsonPage } from "./what-is-motion-json";

export type GettingStartedSlug =
  | ""
  | "how-a-video-is-described"
  | "minimal-project"
  | "ai";

export function isGettingStartedSlug(slug: string): slug is GettingStartedSlug {
  return (
    slug === "" ||
    slug === "how-a-video-is-described" ||
    slug === "minimal-project" ||
    slug === "ai"
  );
}

export function getGettingStartedPage(slug: GettingStartedSlug): DocsPageView {
  switch (slug) {
    case "":
      return whatIsMotionJsonPage();
    case "how-a-video-is-described":
      return howAVideoIsDescribedPage();
    case "minimal-project":
      return minimalProjectPage();
    case "ai":
      return getAiAuthoringPage();
  }
}
