import { AtomPage } from "@/components/docs/AtomPage";
import { DocsVisualExample } from "@/components/docs/DocsVisualExample";
import { ATOM_ORIGIN } from "@/lib/docs/atoms";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";
import { SINGLE_ROOT } from "@/lib/docs/projects";
import { ORIGIN_VARIANTS } from "@/lib/docs/visual-fixtures";

export function originPage(): DocsPageView {
  return withOnThisPage({
    title: "Origin",
    toc: [
      { id: "preview", title: "Preview" },
      { id: "quick-reference", title: "Quick Reference" },
      { id: "meaning", title: "Meaning" },
      { id: "example", title: "Example" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <AtomPage
        title="Origin"
        human="Normalized pivot inside the local frame."
        jsonPath="transform.origin"
        lede="0,0 is top-left. 0.5,0.5 is center. 1,1 is bottom-right. Schema allows any 0..1; AI should prefer 0, 0.5, or 1."
        visual={
          <DocsVisualExample
            path="transform.origin"
            overlay="origin"
            play
            variants={ORIGIN_VARIANTS}
          />
        }
        quick={ATOM_ORIGIN}
        meaning={[
          "Scale, rotate, and skew pivot around this point.",
          "Not anchorX/anchorY.",
        ]}
        authoringExample={{
          transform: { origin: { x: 0.5, y: 0.5 } },
        }}
        valid={SINGLE_ROOT}
        invalid={{
          ...SINGLE_ROOT,
          metadata: { ...SINGLE_ROOT.metadata, id: "bad-origin" },
          layers: [
            {
              ...SINGLE_ROOT.layers[0],
              transform: {
                ...SINGLE_ROOT.layers[0]!.transform,
                origin: { x: 0.5, y: 0.5, z: 0 },
              },
            },
          ],
        }}
        mistakes={["Do not write origin.z or anchorX."]}
        ai={[
          "Prefer origin 0, 0.5, or 1.",
          "Use transform.origin.x/y, never anchorX.",
        ]}
      />
    ),
  });
}
