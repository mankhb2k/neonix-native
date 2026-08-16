import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import { BlendModeFigure } from "@/components/docs/figures/CompositingFigures";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function blendModePage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Blend mode",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "where", title: "Where it lives" },
      { id: "modes", title: "Allowed modes" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Blend mode"
          human="How this visual layer composites over what is already painted."
          jsonPath="compositing.blend-mode"
        />
        <H2 id="concept">Concept</H2>
        <BlendModeFigure />
        <H2 id="where">Where it lives</H2>
        <P>
          Blend is compositing, not appearance and not an effect. Do not put it
          on <code>transform</code> or inside <code>effects[]</code>.
        </P>
        <H2 id="modes">Allowed modes</H2>
        <P>
          The v1 set is closed: <code>normal</code>, <code>multiply</code>,{" "}
          <code>screen</code>, <code>add</code>, <code>darken</code>,{" "}
          <code>lighten</code>, <code>overlay</code>. All seven are
          production-safe. Schema default is <code>normal</code> — omit the
          field when you want that.
        </P>
        <JsonBlock
          code={JSON.stringify(
            { compositing: { "blend-mode": "multiply" } },
            null,
            2,
          )}
        />
        <AiWritingGuide
          items={[
            "Use only the seven listed blend modes. Do not invent others.",
            "Skip blend-mode when it is normal.",
            "Do not put blur, opacity, or crop on compositing.",
          ]}
        />
      </article>
    ),
  });
}
