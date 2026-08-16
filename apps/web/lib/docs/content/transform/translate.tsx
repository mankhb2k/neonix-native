import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { ExampleWithResult } from "@/components/docs/figures/ExampleWithResult";
import {
  TransformExamplePhoto,
  TransformExampleRow,
} from "@/components/docs/figures/TransformExamplePhoto";
import { TranslateFigure } from "@/components/docs/figures/TransformFigures";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { squareImageLayerExample } from "@/lib/docs/content/layers/example-json";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function translatePage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Translate",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "example", title: "Example" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Translate"
          human="Position in composition pixels."
          jsonPath="transform.translate"
        />
        <P>
          <code>translate.x</code> / <code>translate.y</code> move the layer in
          composition pixels. There is no <code>translate.z</code> — use{" "}
          <a className="underline" href="/docs/transform/depth">
            depth
          </a>{" "}
          for near/far.
        </P>

        <H2 id="concept">Concept</H2>
        <TranslateFigure />

        <H2 id="example">Example</H2>
        <ExampleWithResult
          json={JSON.stringify(
            squareImageLayerExample({
              translate: { x: 960, y: 540 },
            }),
            null,
            2,
          )}
          result={
            <TransformExampleRow>
              <TransformExamplePhoto
                label="x 220"
                transform="translate(-18px, 0)"
              />
              <TransformExamplePhoto
                label="x 540"
                transform="translate(0, 0)"
              />
              <TransformExamplePhoto
                label="x 860"
                transform="translate(18px, 0)"
              />
            </TransformExampleRow>
          }
        />

        <AiWritingGuide
          items={[
            "Use transform.translate.x/y for position. Never transform.x / transform.y.",
            "Use transform.depth for near/far — do not put z on translate.",
          ]}
        />
      </article>
    ),
  });
}
