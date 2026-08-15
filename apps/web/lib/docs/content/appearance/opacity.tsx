import { AtomPage } from "@/components/docs/AtomPage";
import { ATOM_OPACITY, ATOM_VISIBLE } from "@/lib/docs/atoms";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";
import { SINGLE_ROOT } from "@/lib/docs/projects";

export function opacityPage(): DocsPageView {
  return withOnThisPage({
    title: "Look",
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
        title="Look"
        human="Visibility and opacity."
        jsonPath="appearance"
        lede="appearance.opacity is an integer percent 0..100 (100 = fully opaque). Not a 0..1 float. Not transform.opacity."
        quick={ATOM_OPACITY}
        meaning={[
          `${ATOM_VISIBLE.path} hides the layer without changing opacity.`,
          "Audio may use appearance; it has no transform.",
        ]}
        authoringExample={{ appearance: { visible: true, opacity: 80 } }}
        valid={SINGLE_ROOT}
        invalid={{
          ...SINGLE_ROOT,
          metadata: { ...SINGLE_ROOT.metadata, id: "bad-opacity" },
          layers: [
            {
              ...SINGLE_ROOT.layers[0],
              appearance: { visible: true, opacity: 0.5 },
            },
          ],
        }}
        mistakes={[
          "Do not use opacity 0..1.",
          "Do not put opacity on transform.",
        ]}
        ai={[
          "Use appearance.opacity for opacity.",
          "Use appearance.visible for hide/show.",
        ]}
      />
    ),
  });
}
