import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { ExampleWithResult } from "@/components/docs/figures/ExampleWithResult";
import {
  TransformExamplePhoto,
  TransformExampleRow,
} from "@/components/docs/figures/TransformExamplePhoto";
import { SkewFigure } from "@/components/docs/figures/TransformFigures";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { squareImageLayerExample } from "@/lib/docs/content/layers/example-json";
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
        <ExampleWithResult
          json={JSON.stringify(
            squareImageLayerExample({ skew: { x: 16, y: 0 } }),
            null,
            2,
          )}
          result={
            <TransformExampleRow>
              <TransformExamplePhoto label="0, 0" transform="none" />
              <TransformExamplePhoto
                label="skew.x 16"
                transform="skewX(16deg)"
              />
              <TransformExamplePhoto
                label="skew.y 12"
                transform="skewY(12deg)"
              />
            </TransformExampleRow>
          }
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
