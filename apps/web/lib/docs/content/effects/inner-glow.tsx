import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { ExampleWithResult } from "@/components/docs/figures/ExampleWithResult";
import {
  TransformExamplePhoto,
  TransformExampleRow,
} from "@/components/docs/figures/TransformExamplePhoto";
import { InnerGlowFigure } from "@/components/docs/figures/EffectsFigures";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { squareImageLayerExample } from "@/lib/docs/content/layers/example-json";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

const INNER_GLOW = {
  id: "fx-inner-glow-1",
  type: "inner-glow",
  radius: 18,
  color: "#A855FF",
  opacity: 0.8,
};

export function innerGlowPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Inner glow",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "meaning", title: "Meaning" },
      { id: "example", title: "Example" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Inner glow"
          human="Even halo along the inside of the layer silhouette."
          jsonPath="effects[].type = inner-glow"
        />
        <H2 id="concept">Concept</H2>
        <InnerGlowFigure />
        <H2 id="meaning">Meaning</H2>
        <P>
          Inner glow is its own effect type. It is not a flag on{" "}
          <code>glow</code>. Strength is <code>opacity</code> (0..100) — do not
          emit <code>intensity</code>, spread, or choke. Bounds stay the same:
          the halo paints inward. Animate <code>radius</code> and{" "}
          <code>opacity</code> linearly. Do not animate <code>color</code>.
        </P>
        <H2 id="example">Example</H2>
        <ExampleWithResult
          json={JSON.stringify(
            squareImageLayerExample({}, { effects: [INNER_GLOW] }),
            null,
            2,
          )}
          result={
            <TransformExampleRow>
              <TransformExamplePhoto label="none" />
              <TransformExamplePhoto
                label="radius 8"
                insetBoxShadow="inset 0 0 14px 4px rgba(168,85,255,0.85)"
              />
              <TransformExamplePhoto
                label="radius 18"
                insetBoxShadow="inset 0 0 28px 10px rgba(168,85,255,0.9)"
              />
            </TransformExampleRow>
          }
        />
        <AiWritingGuide
          items={[
            "Use type inner-glow with radius, color, and opacity.",
            "Do not emit intensity, spread, choke, or blend.",
            "Animate effects.fx-inner-glow-1.radius and effects.fx-inner-glow-1.opacity.",
            "Use outer-glow for an exterior halo; inner-glow paints only inside source alpha.",
          ]}
        />
      </article>
    ),
  });
}
