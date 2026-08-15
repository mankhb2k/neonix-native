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
      { id: "roots", title: "Root lanes" },
      { id: "timeline", title: "Timeline" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName title="What is a layer" jsonPath="layers[]" />
        <P>
          Root layers are timeline lanes. Nesting is <code>group.children</code>
          . Audio is a root-only leaf: no transform, negative zIndex, required
          timing.
        </P>
        <H2 id="roots">Root lanes</H2>
        <JsonBlock
          code={JSON.stringify(
            {
              layers: [
                { id: "bg", type: "solid", parentLayerId: null, zIndex: 0 },
                { id: "title", type: "text", parentLayerId: null, zIndex: 1 },
                { id: "music", type: "audio", parentLayerId: null, zIndex: -1 },
              ],
            },
            null,
            2,
          )}
        />
        <TimelineStrip lanes={strip.lanes} duration={strip.duration} />
        <AiWritingGuide
          items={[
            "Give every root layer a unique zIndex.",
            "Do not parent audio under a group.",
          ]}
        />
      </article>
    ),
  });
}
