import type { DocsPageView } from "@/lib/docs/content/page-view";
import { aiMcpPage } from "./ai-mcp";
import { howAVideoIsDescribedPage } from "./how-a-video-is-described";
import { minimalProjectPage } from "./minimal-project";
import { pixiPreviewPage } from "./pixi-preview";
import { whatIsMotionJsonPage } from "./what-is-motion-json";

export type GettingStartedSlug =
  | ""
  | "how-a-video-is-described"
  | "minimal-project"
  | "ai"
  | "preview";

export function isGettingStartedSlug(slug: string): slug is GettingStartedSlug {
  return (
    slug === "" ||
    slug === "how-a-video-is-described" ||
    slug === "minimal-project" ||
    slug === "ai" ||
    slug === "preview"
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
      return aiMcpPage();
    case "preview":
      return pixiPreviewPage();
  }
}
