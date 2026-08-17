import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { ExampleWithResult } from "@/components/docs/figures/ExampleWithResult";
import {
  TransformExamplePhoto,
  TransformExampleRow,
} from "@/components/docs/figures/TransformExamplePhoto";
import { GlowFigure } from "@/components/docs/figures/EffectsFigures";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { squareImageLayerExample } from "@/lib/docs/content/layers/example-json";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

const GLOW = {
  id: "fx-glow-1",
  type: "glow",
  radius: 16,
  color: "#ffffff",
  opacity: 80,
};

export function glowPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Glow",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "meaning", title: "Meaning" },
      { id: "example", title: "Example" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Glow"
          human="Even outer halo around the layer silhouette."
          jsonPath="effects[].type = glow"
        />
        <H2 id="concept">Concept</H2>
        <GlowFigure />
        <H2 id="meaning">Meaning</H2>
        <P>
          v1 glow is outer only. Inner glow is a separate type{" "}
          <a className="underline" href="/docs/effects/inner-glow">
            inner-glow
          </a>
          , not a flag on this effect. Strength is <code>opacity</code> (0..100)
          — do not emit <code>intensity</code>. Animate <code>radius</code> and{" "}
          <code>opacity</code> linearly. Do not animate <code>color</code>.
        </P>
        <H2 id="example">Example</H2>
        <ExampleWithResult
          json={JSON.stringify(
            squareImageLayerExample({}, { effects: [GLOW] }),
            null,
            2,
          )}
          result={
            <TransformExampleRow>
              <TransformExamplePhoto label="no glow" />
              <TransformExamplePhoto
                label="radius 16"
                boxShadow="0 0 18px 6px rgba(255,255,255,0.8)"
              />
            </TransformExampleRow>
          }
        />
        <AiWritingGuide
          items={[
            "Use type glow with radius, color, and opacity.",
            "Do not emit intensity. Opacity is the visible strength.",
            "Animate effects.fx-glow-1.radius and effects.fx-glow-1.opacity.",
          ]}
        />
      </article>
    ),
  });
}
