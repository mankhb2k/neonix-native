import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function colorAdjustPage(): DocsPageView {
  return withOnThisPage({
    title: "Color adjust",
    toc: [
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
        <H2 id="meaning">Meaning</H2>
        <P>
          This does not change geometry or compositing. Identity is
          brightness, contrast, and saturation at 100, hue-rotate at 0.
          Ranges: 0..200 for the three percents, −180..180 for hue-rotate.
          All four fields animate linearly. Do not emit exposure, gamma,
          vibrance, curves, or temperature. A dedicated grade layer is{" "}
          <a className="underline" href="/docs/layers/adjustment">
            type adjustment
          </a>
          , not this effect.
        </P>
        <H2 id="example">Example</H2>
        <JsonBlock
          code={JSON.stringify(
            {
              id: "fx-color-1",
              type: "color-adjust",
              brightness: 100,
              contrast: 100,
              saturation: 100,
              "hue-rotate": 0,
            },
            null,
            2,
          )}
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
