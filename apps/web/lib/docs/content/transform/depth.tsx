import { AtomPage } from "@/components/docs/AtomPage";
import { ATOM_DEPTH } from "@/lib/docs/atoms";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";
import { DEPTH_DEMO, INVALID_TRANSFORM_Z } from "@/lib/docs/projects";

export function depthPage(): DocsPageView {
  return withOnThisPage({
    title: "Depth",
    toc: [
      { id: "quick-reference", title: "Quick Reference" },
      { id: "meaning", title: "Meaning" },
      { id: "example", title: "Example" },
      { id: "timeline", title: "Timeline" },
      { id: "keyframes", title: "With Keyframes" },
      { id: "valid-invalid", title: "Valid / Invalid" },
      { id: "mistakes", title: "Common mistakes" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <AtomPage
        title="Depth"
        human="Near/far for pseudo-3D and parallax."
        jsonPath="transform.depth"
        lede="Depth controls near/far position for pseudo-3D and parallax."
        quick={ATOM_DEPTH}
        meaning={[
          "0 = normal plane",
          "positive = closer",
          "negative = farther",
          "does not affect zIndex",
        ]}
        authoringExample={{
          transform: {
            translate: { x: 0, y: 0 },
            depth: 120,
          },
        }}
        projectForTimeline={DEPTH_DEMO}
        compiledTrack={{
          layerId: "photo",
          property: "transform.depth",
          valueKind: "number",
          keys: [
            { t: 0, v: -200 },
            { t: 3, v: 120 },
          ],
        }}
        valid={DEPTH_DEMO}
        invalid={INVALID_TRANSFORM_Z}
        mistakes={[
          "Do not use zIndex for parallax.",
          "Do not use depth for stacking order.",
          "Do not write transform.z.",
        ]}
        ai={[
          "Use transform.depth for parallax.",
          "Never invent transform.z.",
          "Keep zIndex for paint order.",
        ]}
      />
    ),
  });
}
