import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { ExampleWithResult } from "@/components/docs/figures/ExampleWithResult";
import {
  TransformExamplePhoto,
  TransformExampleRow,
} from "@/components/docs/figures/TransformExamplePhoto";
import { NoiseFigure } from "@/components/docs/figures/EffectsFigures";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { squareImageLayerExample } from "@/lib/docs/content/layers/example-json";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

const NOISE = {
  id: "fx-noise-1",
  type: "noise",
  amount: 12,
  scale: 1,
  opacity: 25,
  animated: false,
};

export function noisePage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Noise",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "meaning", title: "Meaning" },
      { id: "example", title: "Example" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Noise"
          human="Deterministic grain over the layer pixels."
          jsonPath="effects[].type = noise"
        />
        <H2 id="concept">Concept</H2>
        <NoiseFigure />
        <H2 id="meaning">Meaning</H2>
        <P>
          Grain overlay only. No displacement, glitch slices, chromatic split,
          or scanlines. There is no authoring <code>seed</code> — runtime hashes
          project, layer, effect, and frame when <code>animated</code> is true.{" "}
          <code>amount</code> and <code>opacity</code> are 0..100.{" "}
          <code>scale</code> is 0.25..8 (default 1). Animate those three
          linearly. Do not animate <code>animated</code> (default{" "}
          <code>false</code>).
        </P>
        <H2 id="example">Example</H2>
        <ExampleWithResult
          json={JSON.stringify(
            squareImageLayerExample({}, { effects: [NOISE] }),
            null,
            2,
          )}
          result={
            <TransformExampleRow>
              <TransformExamplePhoto label="amount 0" />
              <TransformExamplePhoto label="amount 12" grain={12} />
              <TransformExamplePhoto label="amount 40" grain={40} />
            </TransformExampleRow>
          }
        />
        <AiWritingGuide
          items={[
            "Use type noise with amount, scale, opacity, and optional animated.",
            "Do not emit seed. Runtime derives a deterministic seed.",
            "Animate effects.fx-noise-1.amount, .scale, and .opacity. Never animate animated.",
            "Keep amount low on HUD cards. Do not fake scanlines with noise.",
          ]}
        />
      </article>
    ),
  });
}
