import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { ExampleWithResult } from "@/components/docs/figures/ExampleWithResult";
import {
  TransformExamplePhoto,
  TransformExampleRow,
} from "@/components/docs/figures/TransformExamplePhoto";
import { RotateFigure } from "@/components/docs/figures/TransformFigures";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { squareImageLayerExample } from "@/lib/docs/content/layers/example-json";
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
        <ExampleWithResult
          json={JSON.stringify(
            squareImageLayerExample({ rotate: { z: 15 } }),
            null,
            2,
          )}
          result={
            <TransformExampleRow>
              <TransformExamplePhoto label="rotate.z 0" transform="none" />
              <TransformExamplePhoto
                label="rotate.z 15"
                transform="rotate(15deg)"
              />
              <TransformExamplePhoto
                label="rotate.z 45"
                transform="rotate(45deg)"
              />
            </TransformExampleRow>
          }
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
