import { AtomPage } from "@/components/docs/AtomPage";
import { ATOM_SCALE } from "@/lib/docs/atoms";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";
import { SINGLE_ROOT } from "@/lib/docs/projects";

export function scalePage(): DocsPageView {
  return withOnThisPage({
    title: "Scale",
    toc: [
      { id: "quick-reference", title: "Quick Reference" },
      { id: "meaning", title: "Meaning" },
      { id: "example", title: "Example" },
      { id: "valid-invalid", title: "Valid / Invalid" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <AtomPage
        title="Scale"
        human="Per-axis size relative to the local frame. Negative values flip."
        jsonPath="transform.scale"
        lede="1 is the original size. scale.x = -1 flips horizontally. There is no flipX or flipY."
        quick={ATOM_SCALE}
        meaning={[
          "Applies around transform.origin.",
          "Negative x or y mirrors that axis.",
          "Not a substitute for frame width/height.",
        ]}
        authoringExample={{
          transform: { scale: { x: -1, y: 1 } },
        }}
        valid={SINGLE_ROOT}
        invalid={{
          ...SINGLE_ROOT,
          metadata: { ...SINGLE_ROOT.metadata, id: "bad-scale" },
          layers: [
            {
              ...SINGLE_ROOT.layers[0],
              transform: {
                ...SINGLE_ROOT.layers[0]!.transform,
                flipX: true,
              },
            },
          ],
        }}
        mistakes={[
          "Do not emit flipX or flipY.",
          "Do not put size on transform — that is frame.",
        ]}
        ai={[
          "Flip with scale.x or scale.y = -1.",
          "Never invent flipX, flipY, or scale.z.",
        ]}
      />
    ),
  });
}
