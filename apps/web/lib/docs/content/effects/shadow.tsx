import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { ExampleWithResult } from "@/components/docs/figures/ExampleWithResult";
import {
  TransformExamplePhoto,
  TransformExampleRow,
} from "@/components/docs/figures/TransformExamplePhoto";
import { ShadowFigure } from "@/components/docs/figures/EffectsFigures";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { squareImageLayerExample } from "@/lib/docs/content/layers/example-json";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

const SHADOW = {
  id: "fx-shadow-1",
  type: "shadow",
  offset: { x: 8, y: 12 },
  blur: 24,
  color: "#000000",
  opacity: 25,
};

export function shadowPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Shadow",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "meaning", title: "Meaning" },
      { id: "example", title: "Example" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Shadow"
          human="Outer drop shadow of this layer."
          jsonPath="effects[].type = shadow"
        />
        <H2 id="concept">Concept</H2>
        <ShadowFigure />
        <H2 id="meaning">Meaning</H2>
        <P>
          Direction comes from <code>offset.x</code> / <code>offset.y</code>.
          There is no inner shadow, spread, angle, or distance in v1.{" "}
          <code>opacity</code> is 0..100 (default 25). Animate offset leaves,{" "}
          <code>blur</code>, and <code>opacity</code> linearly. Do not animate{" "}
          <code>color</code>.
        </P>
        <H2 id="example">Example</H2>
        <ExampleWithResult
          json={JSON.stringify(
            squareImageLayerExample({}, { effects: [SHADOW] }),
            null,
            2,
          )}
          result={
            <TransformExampleRow>
              <TransformExamplePhoto label="no shadow" />
              <TransformExamplePhoto
                label="offset 8, 12"
                boxShadow="8px 12px 16px rgba(0,0,0,0.25)"
              />
            </TransformExampleRow>
          }
        />
        <AiWritingGuide
          items={[
            "Use outer shadow with offset, blur, color, and opacity.",
            "Animate effects.fx-shadow-1.offset.x, not the whole offset object.",
            "Do not animate shadow color in v1.",
          ]}
        />
      </article>
    ),
  });
}
