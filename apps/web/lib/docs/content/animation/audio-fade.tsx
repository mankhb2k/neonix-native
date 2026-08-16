import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import { AudioFadeFigure } from "@/components/docs/figures/AnimationFigures";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function audioFadePage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Audio fade",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "example", title: "Example" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Audio fade"
          human="Volume ramps at the edges of an audio lane."
          jsonPath="payload.fadeIn / payload.fadeOut"
        />
        <P>
          <code>fadeIn</code> and <code>fadeOut</code> shape the volume envelope
          in seconds. They are separate from <code>trimStart</code> /{" "}
          <code>trimEnd</code>, which cut the source media.
        </P>

        <H2 id="concept">Concept</H2>
        <AudioFadeFigure />

        <H2 id="example">Example</H2>
        <JsonBlock
          caption="Authoring JSON (fragment)"
          code={JSON.stringify(
            {
              id: "music",
              type: "audio",
              parentLayerId: null,
              zIndex: -1,
              timing: { start: 0, duration: 8 },
              payload: {
                assetId: "bgm",
                trimStart: 0,
                volume: 80,
                fadeIn: 0.5,
                fadeOut: 1,
                loop: false,
                muted: false,
              },
            },
            null,
            2,
          )}
        />

        <AiWritingGuide
          items={[
            "Use fadeIn / fadeOut in seconds on the audio payload.",
            "Fades shape the volume envelope — trim cuts the source.",
          ]}
        />
      </article>
    ),
  });
}
