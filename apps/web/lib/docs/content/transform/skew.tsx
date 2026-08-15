import { AtomPage } from "@/components/docs/AtomPage";
import { ATOM_SKEW } from "@/lib/docs/atoms";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";
import { SINGLE_ROOT } from "@/lib/docs/projects";

export function skewPage(): DocsPageView {
  return withOnThisPage({
    title: "Skew",
    toc: [
      { id: "quick-reference", title: "Quick Reference" },
      { id: "meaning", title: "Meaning" },
      { id: "example", title: "Example" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <AtomPage
        title="Skew"
        human="Shear the local box, in degrees."
        jsonPath="transform.skew"
        lede="skew.x and skew.y stay in V1. They apply around origin after scale/rotate in the transform pipeline."
        quick={ATOM_SKEW}
        meaning={["Kept in V1.", "Not a layout or effect."]}
        authoringExample={{
          transform: { skew: { x: 8, y: 0 } },
        }}
        valid={SINGLE_ROOT}
        invalid={{
          ...SINGLE_ROOT,
          metadata: { ...SINGLE_ROOT.metadata, id: "bad-skew" },
          layers: [
            {
              ...SINGLE_ROOT.layers[0],
              transform: {
                ...SINGLE_ROOT.layers[0]!.transform,
                matrix: [1, 0, 0, 1, 0, 0],
              },
            },
          ],
        }}
        mistakes={["Do not use a matrix field instead of skew."]}
        ai={["Use transform.skew.x/y. Do not emit a matrix."]}
      />
    ),
  });
}
