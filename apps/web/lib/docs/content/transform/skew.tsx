import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import { SkewFigure } from "@/components/docs/figures/TransformFigures";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function skewPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Skew",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "example", title: "Example" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Skew"
          human="Shear the local box, in degrees."
          jsonPath="transform.skew"
        />
        <P>
          <code>skew.x</code> and <code>skew.y</code> stay in V1. They apply
          around origin after scale/rotate in the transform pipeline. Not a
          layout or an effect.
        </P>

        <H2 id="concept">Concept</H2>
        <SkewFigure />

        <H2 id="example">Example</H2>
        <JsonBlock
          caption="Authoring JSON (fragment)"
          code={JSON.stringify(
            { transform: { skew: { x: 8, y: 0 } } },
            null,
            2,
          )}
        />

        <AiWritingGuide
          items={[
            "Use transform.skew.x/y. Do not emit a matrix field.",
            "Skew applies around origin, after scale/rotate.",
          ]}
        />
      </article>
    ),
  });
}
