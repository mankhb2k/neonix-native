import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import { RotateFigure } from "@/components/docs/figures/TransformFigures";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function rotatePage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Rotate",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "example", title: "Example" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Rotate"
          human="2D rotation around Z, in degrees."
          jsonPath="transform.rotate.z"
        />
        <P>
          Only <code>rotate.z</code> exists in V1. There is no 3D{" "}
          <code>rotate.x</code> or <code>rotate.y</code>. Rotation pivots around{" "}
          <a className="underline" href="/docs/transform/origin">
            origin
          </a>{" "}
          and never changes paint order.
        </P>

        <H2 id="concept">Concept</H2>
        <RotateFigure />

        <H2 id="example">Example</H2>
        <JsonBlock
          caption="Authoring JSON (fragment)"
          code={JSON.stringify({ transform: { rotate: { z: 15 } } }, null, 2)}
        />

        <AiWritingGuide
          items={[
            "Use transform.rotate.z for 2D rotation.",
            "Never invent rotate.x, rotate.y, or a rotation field.",
          ]}
        />
      </article>
    ),
  });
}
