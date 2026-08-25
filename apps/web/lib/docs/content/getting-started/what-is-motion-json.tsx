import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { AI_GLOBAL } from "./ai-rules";

export function whatIsMotionJsonPage(): DocsPageView {
  return {
    title: "What is Motion JSON?",
    toc: [
      { id: "pipeline", title: "Pipeline" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="What is Motion JSON?"
          human="Authoring source of truth for a Neonix video."
        />
        <P>
          Motion JSON is <code>MotionProjectV1</code>: one strict JSON document
          that AI, the editor, and export all parse with the same schemas.
          Extra keys are rejected. Layers are the timeline.
        </P>
        <H2 id="pipeline">Pipeline</H2>
        <JsonBlock
          caption="Author the project. Preview and export consume the same file."
          code={`V1 JSON
  → parse (schema + references)
  → compile
  → editor preview
  → export MP4`}
        />
        <AiWritingGuide items={AI_GLOBAL} />
      </article>
    ),
  };
}
