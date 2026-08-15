import { AtomPage } from "@/components/docs/AtomPage";
import { ATOM_ROTATE } from "@/lib/docs/atoms";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";
import { SINGLE_ROOT } from "@/lib/docs/projects";

export function rotatePage(): DocsPageView {
  return withOnThisPage({
    title: "Rotate",
    toc: [
      { id: "quick-reference", title: "Quick Reference" },
      { id: "meaning", title: "Meaning" },
      { id: "example", title: "Example" },
      { id: "valid-invalid", title: "Valid / Invalid" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <AtomPage
        title="Rotate"
        human="2D rotation around Z, in degrees."
        jsonPath="transform.rotate.z"
        lede="Only rotate.z exists in V1. There is no 3D rotate.x or rotate.y."
        quick={ATOM_ROTATE}
        meaning={[
          "Pivots around transform.origin.",
          "Does not change paint order.",
        ]}
        authoringExample={{
          transform: { rotate: { z: 15 } },
        }}
        valid={SINGLE_ROOT}
        invalid={{
          ...SINGLE_ROOT,
          metadata: { ...SINGLE_ROOT.metadata, id: "bad-rotate" },
          layers: [
            {
              ...SINGLE_ROOT.layers[0],
              transform: {
                ...SINGLE_ROOT.layers[0]!.transform,
                rotate: { x: 10, z: 0 },
              },
            },
          ],
        }}
        mistakes={["Do not write rotation or rotate.x/y."]}
        ai={[
          "Use transform.rotate.z for 2D rotation.",
          "Never invent rotate.x, rotate.y, or rotation.",
        ]}
      />
    ),
  });
}
