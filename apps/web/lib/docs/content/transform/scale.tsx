import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { ExampleWithResult } from "@/components/docs/figures/ExampleWithResult";
import {
  TransformExamplePhoto,
  TransformExampleRow,
} from "@/components/docs/figures/TransformExamplePhoto";
import { ScaleFigure } from "@/components/docs/figures/TransformFigures";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { squareImageLayerExample } from "@/lib/docs/content/layers/example-json";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function scalePage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Scale",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "example", title: "Example" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Scale"
          human="Per-axis size relative to the local frame. Negative values flip."
          jsonPath="transform.scale"
        />
        <P>
          <code>1</code> is the original size. <code>scale.x = -1</code> flips
          horizontally. There is no <code>flipX</code> or <code>flipY</code>.
          Scale applies around{" "}
          <a className="underline" href="/docs/transform/origin">
            origin
          </a>
          .
        </P>

        <H2 id="concept">Concept</H2>
        <ScaleFigure />

        <H2 id="example">Example</H2>
        <ExampleWithResult
          json={JSON.stringify(
            squareImageLayerExample({ scale: { x: -1, y: 1 } }),
            null,
            2,
          )}
          result={
            <TransformExampleRow>
              <TransformExamplePhoto label="1, 1" transform="none" />
              <TransformExamplePhoto
                label="1.4, 1.4"
                transform="scale(1.4)"
              />
              <TransformExamplePhoto
                label="-1, 1"
                transform="scaleX(-1)"
              />
            </TransformExampleRow>
          }
        />

        <AiWritingGuide
          items={[
            "Flip with scale.x or scale.y = -1.",
            "Never invent flipX, flipY, or scale.z.",
            "Scale is not a substitute for frame width/height.",
          ]}
        />
      </article>
    ),
  });
}
