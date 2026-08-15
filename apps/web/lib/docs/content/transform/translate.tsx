import { AtomPage } from "@/components/docs/AtomPage";
import { ATOM_TRANSLATE } from "@/lib/docs/atoms";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";
import { SINGLE_ROOT } from "@/lib/docs/projects";

export function translatePage(): DocsPageView {
  return withOnThisPage({
    title: "Move",
    toc: [
      { id: "quick-reference", title: "Quick Reference" },
      { id: "meaning", title: "Meaning" },
      { id: "example", title: "Example" },
      { id: "valid-invalid", title: "Valid / Invalid" },
      { id: "mistakes", title: "Common mistakes" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <AtomPage
        title="Move"
        human="Position in composition pixels."
        jsonPath="transform.translate"
        lede="translate.x / translate.y move the layer. There is no translate.z — use depth."
        quick={ATOM_TRANSLATE}
        meaning={[
          "x/y are composition pixels.",
          "Origin is transform.origin (0..1).",
        ]}
        authoringExample={{
          transform: { translate: { x: 960, y: 540 }, depth: 0 },
        }}
        valid={SINGLE_ROOT}
        invalid={{
          ...SINGLE_ROOT,
          metadata: { ...SINGLE_ROOT.metadata, id: "bad-xy" },
          layers: [
            {
              ...SINGLE_ROOT.layers[0],
              transform: { x: 10, y: 20 },
            },
          ],
        }}
        mistakes={[
          "Do not use transform.x / transform.y.",
          "Do not put z on translate.",
        ]}
        ai={[
          "Use transform.translate.x/y for position.",
          "Use transform.depth for near/far.",
        ]}
      />
    ),
  });
}
