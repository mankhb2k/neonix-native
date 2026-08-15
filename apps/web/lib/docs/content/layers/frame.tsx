import { AtomPage } from "@/components/docs/AtomPage";
import { ATOM_FRAME } from "@/lib/docs/atoms";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";
import { SINGLE_ROOT } from "@/lib/docs/projects";

export function framePage(): DocsPageView {
  return withOnThisPage({
    title: "Frame",
    toc: [
      { id: "quick-reference", title: "Quick Reference" },
      { id: "example", title: "Example" },
      { id: "valid-invalid", title: "Valid / Invalid" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <AtomPage
        title="Frame"
        human="Local size box of this layer, before transform."
        jsonPath="frame"
        lede="frame.width and frame.height are how big this layer is in local space. Transform moves or scales that box. Frame is not a timeline unit, not a group, and not a clip."
        quick={ATOM_FRAME}
        meaning={[
          "Width/height in pixels, before translate/scale/rotate.",
          "Used for text wrap, media fit/crop, shape box, hit-test, mask/effect bounds.",
          "Does not control children, stacking, or timing. Required on group; that box does not clip.",
        ]}
        authoringExample={{ frame: { width: 800, height: 120 } }}
        valid={SINGLE_ROOT}
        invalid={{
          ...SINGLE_ROOT,
          metadata: { ...SINGLE_ROOT.metadata, id: "bad-frame" },
          layers: [
            {
              ...SINGLE_ROOT.layers[0],
              frame: { width: -8, height: 120 },
            },
          ],
        }}
        mistakes={[
          "Do not put size on transform.width/height.",
          "Do not use scale as the layout size unless you mean scale.",
          "Do not treat frame as a clip rect or as a group.",
        ]}
        ai={[
          "If the layer is visual (including group), always set frame.",
          "Group frame is required and does not clip children. Never derive it from children in canonical JSON.",
          "Audio and camera must not have frame.",
        ]}
      />
    ),
  });
}
