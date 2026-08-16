import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import { TimelineStrip } from "@/components/docs/TimelineStrip";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";

export function layerTimingPage(): DocsPageView {
  return {
    title: "Layer timing",
    showToc: false,
    toc: [
      { id: "required", title: "Required on every layer" },
      { id: "local", title: "Child timing is local" },
      { id: "effective", title: "Effective window" },
      { id: "trim", title: "No layer trim field" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Layer timing"
          human="When the layer is alive. Children count from their parent, then get clipped by that parent."
          jsonPath="layers[].timing"
        />
        <H2 id="required">Required on every layer</H2>
        <P>
          Every layer has <code>timing.start</code> and{" "}
          <code>timing.duration</code> in seconds. Root timing sits on the
          project clock. Omitting timing is invalid.
        </P>
        <JsonBlock
          code={JSON.stringify(
            { timing: { start: 0.5, duration: 4 } },
            null,
            2,
          )}
        />
        <H2 id="local">Child timing is local</H2>
        <P>
          A child <code>start</code> is measured from the parent in-point, not
          from time zero of the video. Child <code>start + duration</code> must
          not exceed the parent <code>duration</code>.
        </P>
        <H2 id="effective">Effective window</H2>
        <TimelineStrip
          hideHeading
          duration={8}
          lanes={[
            { id: "parent", start: 2, duration: 4 },
            { id: "child (local 1+2)", start: 3, duration: 2 },
          ]}
        />
        <P>
          The layer is visible only in the intersection of its window and every
          ancestor:
        </P>
        <JsonBlock
          code={`globalStart = parentGlobalStart + child.start
globalEnd   = min(parentGlobalEnd, globalStart + child.duration)`}
        />
        <H2 id="trim">No layer trim field</H2>
        <P>
          Editor trim is not a protocol field. After a trim, write the new{" "}
          <code>start</code> and <code>duration</code>. Audio{" "}
          <code>payload.trimStart</code> / <code>trimEnd</code> cut the media
          file, not the layer lane.
        </P>
        <AiWritingGuide
          items={[
            "Put timing on every layer, including nested children.",
            "Child start is local to the parent. Keep the child inside the parent duration.",
            "Do not invent trim, inPoint, or outPoint on visual layers.",
          ]}
        />
      </article>
    ),
  };
}
