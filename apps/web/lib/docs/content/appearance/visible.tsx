import { AtomPage } from "@/components/docs/AtomPage";
import { ATOM_VISIBLE } from "@/lib/docs/atoms";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";
import { SINGLE_ROOT } from "@/lib/docs/projects";

export function visiblePage(): DocsPageView {
  return withOnThisPage({
    title: "Visible",
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
        title="Visible"
        human="Whether the visual layer is rendered."
        jsonPath="appearance.visible"
        lede="appearance.visible is render on/off for visual layers. It is not hit-test, selection, or editor lock. Audio has no appearance; mute with payload.muted."
        quick={ATOM_VISIBLE}
        meaning={[
          "false means the layer is not painted. Opacity can stay 100.",
          "JSON protocol does not define hit-test or UI selection from this field.",
        ]}
        authoringExample={{ appearance: { visible: false, opacity: 100 } }}
        valid={SINGLE_ROOT}
        invalid={
          {
            ...SINGLE_ROOT,
            metadata: { ...SINGLE_ROOT.metadata, id: "bad-visible" },
            layers: [
              {
                ...SINGLE_ROOT.layers[0],
                appearance: { visible: "hidden", opacity: 100 },
              },
            ],
          } as unknown
        }
        mistakes={[
          "Do not use appearance.visible to mute audio.",
          "Do not invent pointer-events or hitTest on appearance.",
        ]}
        ai={[
          "Set appearance.visible on visual layers only.",
          "Do not emit hit-test fields.",
        ]}
      />
    ),
  });
}
