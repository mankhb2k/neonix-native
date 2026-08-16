import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import { OriginFigure } from "@/components/docs/figures/TransformFigures";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function originPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Origin",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "example", title: "Example" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Origin"
          human="Normalized pivot inside the local frame."
          jsonPath="transform.origin"
        />
        <P>
          <code>0,0</code> is top-left. <code>0.5,0.5</code> is center.{" "}
          <code>1,1</code> is bottom-right. Scale, rotate, and skew pivot around
          this point. Not <code>anchorX</code> / <code>anchorY</code>.
        </P>

        <H2 id="concept">Concept</H2>
        <OriginFigure />

        <H2 id="example">Example</H2>
        <JsonBlock
          caption="Authoring JSON (fragment)"
          code={JSON.stringify(
            { transform: { origin: { x: 0.5, y: 0.5 } } },
            null,
            2,
          )}
        />

        <AiWritingGuide
          items={[
            "Prefer origin 0, 0.5, or 1. Schema allows any 0..1.",
            "Use transform.origin.x/y, never anchorX or origin.z.",
          ]}
        />
      </article>
    ),
  });
}
