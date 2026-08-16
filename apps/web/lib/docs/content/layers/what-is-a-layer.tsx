import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import { TimelineStrip, lanesFromProject } from "@/components/docs/TimelineStrip";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";
import { AUDIO_FADE } from "@/lib/docs/projects";

export function whatIsALayerPage(): DocsPageView {
  const strip = lanesFromProject(AUDIO_FADE);
  return withOnThisPage({
    title: "What is a layer",
    previewProject: AUDIO_FADE,
    toc: [
      { id: "primitive", title: "The authoring primitive" },
      { id: "roots", title: "Root lanes" },
      { id: "metadata", title: "semantic vs locked" },
      { id: "timeline", title: "Timeline" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName title="What is a layer" jsonPath="layers[]" />
        <H2 id="primitive">The authoring primitive</H2>
        <P>
          A visual layer is the picture object you author: what it is, where
          it sits, when it lives, how it looks, and how it relates to its
          parent. Nesting is <code>group.children</code>. Audio is a special
          exception — still a timeline object on <code>project.layers</code>,
          but not a visual primitive. See the audio page for playback, trim,
          volume, fade, loop, muted, and root-only rules.
        </P>
        <H2 id="roots">Root lanes</H2>
        <JsonBlock
          code={JSON.stringify(
            {
              layers: [
                {
                  id: "bg",
                  type: "solid",
                  parentLayerId: null,
                  zIndex: 0,
                  timing: { start: 0, duration: 8 },
                },
                {
                  id: "title",
                  type: "text",
                  parentLayerId: null,
                  zIndex: 1,
                  timing: { start: 0.5, duration: 4 },
                },
                {
                  id: "music",
                  type: "audio",
                  parentLayerId: null,
                  zIndex: -1,
                  timing: { start: 0, duration: 8 },
                },
              ],
            },
            null,
            2,
          )}
        />
        <H2 id="metadata">semantic vs locked</H2>
        <P>
          <code>semantic</code> is optional tagging for search, AI, and humans.
          It does not change how the layer paints. Do not emit{" "}
          <code>locked</code> in authoring JSON — that is editor UI state, not
          scene data.
        </P>
        <TimelineStrip lanes={strip.lanes} duration={strip.duration} />
        <AiWritingGuide
          items={[
            "Give every layer unique sibling zIndex and required timing.",
            "Treat audio as a special root-only exception. See the audio page.",
            "Skip locked. Use semantic only as labels, never as render hints.",
            "Pack children with group.layout and child.layoutItem.",
            "Do not put hit-test or editor selection into JSON.",
          ]}
        />
      </article>
    ),
  });
}
