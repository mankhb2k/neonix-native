import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import { AdjustmentFigure } from "@/components/docs/figures/AdjustmentFigure";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function adjustmentLayerPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Adjustment",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "what", title: "Layer, not an effect" },
      { id: "payload", title: "Payload" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Adjustment"
          human="A grade layer in the tree. Not effects[].type color-adjust."
          jsonPath='layers[] type: "adjustment"'
        />
        <H2 id="concept">Concept</H2>
        <AdjustmentFigure />
        <H2 id="what">Layer, not an effect</H2>
        <P>
          <code>type: &quot;adjustment&quot;</code> is its own layer. It has
          frame, timing, and zIndex like other visuals.{" "}
          <code>effects[].type = &quot;color-adjust&quot;</code> grades that one
          layer. Do not swap the two.
        </P>
        <H2 id="payload">Payload</H2>
        <P>
          Optional leaves: <code>brightness</code>, <code>contrast</code>,{" "}
          <code>saturation</code> (percents), <code>hue-rotate</code> (degrees).
          Same identity as the effect: 100 / 100 / 100 / 0.
        </P>
        <JsonBlock
          code={JSON.stringify(
            {
              id: "grade-all",
              type: "adjustment",
              frame: { width: 1920, height: 1080 },
              payload: {
                brightness: 100,
                contrast: 110,
                saturation: 90,
                "hue-rotate": 0,
              },
            },
            null,
            2,
          )}
        />
        <AiWritingGuide
          items={[
            "Use type adjustment for a dedicated grade layer.",
            "Use effects color-adjust to grade one existing layer.",
            "Do not invent exposure, gamma, curves, or temperature.",
          ]}
        />
      </article>
    ),
  });
}
