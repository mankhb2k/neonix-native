import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { ExampleWithResult } from "@/components/docs/figures/ExampleWithResult";
import {
  TransformExamplePhoto,
  TransformExampleRow,
} from "@/components/docs/figures/TransformExamplePhoto";
import { ColorAdjustFigure } from "@/components/docs/figures/EffectsFigures";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { squareImageLayerExample } from "@/lib/docs/content/layers/example-json";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

const COLOR_ADJUST = {
  id: "fx-color-1",
  type: "color-adjust",
  brightness: 100,
  contrast: 110,
  saturation: 40,
  "hue-rotate": 0,
};

export function colorAdjustPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Color adjust",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "meaning", title: "Meaning" },
      { id: "example", title: "Example" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Color adjust"
          human="Pixel color grade on this layer."
          jsonPath="effects[].type = color-adjust"
        />
        <H2 id="concept">Concept</H2>
        <ColorAdjustFigure />
        <H2 id="meaning">Meaning</H2>
        <P>
          This does not change geometry or compositing. Identity is brightness,
          contrast, and saturation at 100, hue-rotate at 0. Ranges: 0..200 for
          the three percents, −180..180 for hue-rotate. All four fields animate
          linearly. Do not emit exposure, gamma, vibrance, curves, or
          temperature. A dedicated grade layer is{" "}
          <a className="underline" href="/docs/layers/adjustment">
            type adjustment
          </a>
          , not this effect.
        </P>
        <H2 id="example">Example</H2>
        <ExampleWithResult
          json={JSON.stringify(
            squareImageLayerExample({}, { effects: [COLOR_ADJUST] }),
            null,
            2,
          )}
          result={
            <TransformExampleRow>
              <TransformExamplePhoto label="identity" />
              <TransformExamplePhoto
                label="saturation 40"
                filter="saturate(0.4)"
              />
              <TransformExamplePhoto
                label="hue-rotate 40"
                filter="hue-rotate(40deg)"
              />
            </TransformExampleRow>
          }
        />
        <AiWritingGuide
          items={[
            "Use color-adjust on the layer you want to grade, not as compositing.",
            "A stack-wide grade is type adjustment, not this effect.",
            "Animate effects.fx-color-1.brightness and the other three leaves.",
            "100/100/100 and hue-rotate 0 is identity.",
          ]}
        />
      </article>
    ),
  });
}
