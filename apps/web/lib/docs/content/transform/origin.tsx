import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { ExampleWithResult } from "@/components/docs/figures/ExampleWithResult";
import {
  TransformExamplePhoto,
  TransformExampleRow,
} from "@/components/docs/figures/TransformExamplePhoto";
import { OriginFigure } from "@/components/docs/figures/TransformFigures";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { squareImageLayerExample } from "@/lib/docs/content/layers/example-json";
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
        <ExampleWithResult
          json={JSON.stringify(
            squareImageLayerExample({
              origin: { x: 0.5, y: 0.5 },
              rotate: { z: 25 },
            }),
            null,
            2,
          )}
          result={
            <TransformExampleRow>
              <TransformExamplePhoto
                label="0, 0"
                transform="rotate(25deg)"
                origin="0 0"
              />
              <TransformExamplePhoto
                label="0.5, 0.5"
                transform="rotate(25deg)"
                origin="50% 50%"
              />
              <TransformExamplePhoto
                label="1, 1"
                transform="rotate(25deg)"
                origin="100% 100%"
              />
            </TransformExampleRow>
          }
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
