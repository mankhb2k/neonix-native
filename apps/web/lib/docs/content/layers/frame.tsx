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
        human="Size box before scale/rotate."
        jsonPath="frame"
        lede="frame.width and frame.height are the layer box. They are not transform.scale and not composition size."
        quick={ATOM_FRAME}
        meaning={[
          "Width/height in pixels, before scale.",
          "Not translate. Not composition.width.",
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
          "Do not use scale as a substitute for layout size unless you mean scale.",
        ]}
        ai={[
          "Use frame.width / frame.height for the size box.",
          "Use transform.scale only to scale that box.",
        ]}
      />
    ),
  });
}
