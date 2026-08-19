import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { TimelineStrip } from "@/components/docs/TimelineStrip";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function timelinePage(): DocsPageView {
  return withOnThisPage({
      title: "Timing",
    showToc: false,
    toc: [
      { id: "clock", title: "Clock, not tracks" },
      { id: "duration", title: "Duration" },
      { id: "bounds", title: "Bounds" },
      { id: "strip", title: "Three lanes" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Timing"
          human="Project length is derived from root layers. The UI timeline is not protocol JSON."
          jsonPath="layers[].timing"
        />
        <H2 id="clock">Derived length, not a protocol timeline</H2>
        <P>
          Authoring JSON has no <code>timeline</code> field. Picture and sound
          live on <code>layers[]</code>. Captions are a group with text children
          — not a track type. Editor lanes and playhead are UI-only.
        </P>
        <H2 id="duration">Duration</H2>
        <P>
          Project length is always{" "}
          <code>max(root.timing.start + root.timing.duration)</code>. Empty
          project: <code>0</code>. The compiler stamps that onto{" "}
          <code>runtime.timeline.duration</code> for export. There is no black
          tail after the last root layer.
        </P>
        <H2 id="bounds">Bounds</H2>
        <P>
          Child timing is local to the parent and does not extend the MP4
          length. A child must stay inside <code>parent.timing.duration</code>.
        </P>
        <H2 id="strip">Three lanes</H2>
        <P>
          Seconds on the axis. Each bar is a root layer. The clock itself has no
          lanes.
        </P>
        <TimelineStrip
          hideHeading
          duration={8}
          lanes={[
            { id: "bg", start: 0, duration: 8 },
            { id: "title", start: 0.5, duration: 4 },
            { id: "music", start: 0, duration: 8 },
          ]}
        />
        <AiWritingGuide
          items={[
            "Do not create visualTracks, audioTracks, or captionTracks.",
            "Caption = group + text layers, not a timeline track type.",
            "Derive duration from root layer timing only.",
          ]}
        />
      </article>
    ),
  });
}
