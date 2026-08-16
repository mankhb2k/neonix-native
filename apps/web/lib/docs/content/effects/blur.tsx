import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import { BlurFigure } from "@/components/docs/figures/EffectsFigures";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function blurPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Blur",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "meaning", title: "Meaning" },
      { id: "example", title: "Example" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Blur"
          human="Softens this layer’s own pixels."
          jsonPath="effects[].type = blur"
        />
        <H2 id="concept">Concept</H2>
        <BlurFigure />
        <H2 id="meaning">Meaning</H2>
        <P>
          Blur is not glow. It has no direction and no inner/outer variant in
          v1. The only field is non-negative <code>radius</code>. Animate{" "}
          <code>effects.&lt;id&gt;.radius</code> with linear interpolation. Do
          not emit directional blur, radiusX/radiusY, or quality.
        </P>
        <H2 id="example">Example</H2>
        <JsonBlock
          code={JSON.stringify(
            { id: "fx-blur-1", type: "blur", radius: 12 },
            null,
            2,
          )}
        />
        <AiWritingGuide
          items={[
            "Use type blur with radius only.",
            "Animate effects.fx-blur-1.radius.",
          ]}
        />
      </article>
    ),
  });
}
