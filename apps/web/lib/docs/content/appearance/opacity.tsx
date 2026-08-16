import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import { OpacityFigure } from "@/components/docs/figures/CompositingFigures";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function opacityPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Opacity",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "example", title: "Example" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Opacity"
          human="How opaque the layer is, as an integer percent."
          jsonPath="appearance.opacity"
        />
        <P>
          <code>appearance</code> is the minimum display layer:{" "}
          <code>visible</code> plus <code>opacity</code>. Opacity is an integer
          percent <code>0..100</code> (100 = fully opaque) — not a 0..1 float,
          never on <code>transform</code>. Parent opacity multiplies down to
          children. Audio has no appearance.
        </P>

        <H2 id="concept">Concept</H2>
        <OpacityFigure />

        <H2 id="example">Example</H2>
        <JsonBlock
          caption="Authoring JSON (fragment)"
          code={JSON.stringify(
            { appearance: { visible: true, opacity: 80 } },
            null,
            2,
          )}
        />

        <AiWritingGuide
          items={[
            "Use appearance.opacity as an integer 0..100 — never 0..1.",
            "Do not put opacity on transform.",
            "Audio uses payload.muted and payload.volume, not appearance.",
          ]}
        />
      </article>
    ),
  });
}
