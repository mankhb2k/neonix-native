import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { TimelineStrip } from "@/components/docs/TimelineStrip";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function timelinePage(): DocsPageView {
  return withOnThisPage({
    title: "Timeline",
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
          title="Timeline"
          human="The clock of the video. Not a track list."
          jsonPath="timeline"
        />
        <H2 id="clock">Clock, not tracks</H2>
        <P>
          <code>timeline</code> only has <code>duration?</code>,{" "}
          <code>workArea?</code>, <code>markers?</code>. Picture and sound live
          on <code>layers[]</code>. Captions are a group with text children —
          not a track type.
        </P>
        <H2 id="duration">Duration</H2>
        <P>
          Authoring: <code>duration</code> is optional. If omitted, it is
          derived from root <code>timing.start + timing.duration</code>.
          Canonical / export: <code>duration</code> is required. That value is
          the MP4 length.
        </P>
        <H2 id="bounds">Bounds</H2>
        <P>
          A root layer must not end after <code>timeline.duration</code>. Child
          timing is local to the parent and does not extend the MP4 length.{" "}
          <code>workArea</code> and markers must sit inside that duration.
        </P>
        <H2 id="strip">Three lanes</H2>
        <P>
          Seconds on the axis. Each bar is a root layer. The clock itself has
          no lanes.
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
