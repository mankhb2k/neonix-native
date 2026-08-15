import { HumanName } from "@/components/docs/HumanName";
import { SINGLE_ROOT } from "@/lib/docs/projects";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";

export function howAVideoIsDescribedPage(): DocsPageView {
  return {
    title: "How a video is described",
    previewProject: SINGLE_ROOT,
    toc: [
      { id: "mental-model", title: "Mental model" },
      { id: "clock", title: "Clock vs lanes" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="How a video is described"
          human="Envelope first (composition + timeline + assets), then layers."
        />
        <H2 id="mental-model">Mental model</H2>
        <P>
          The project file is the video.{" "}
          <a className="underline" href="/docs/project">
            Project
          </a>{" "}
          owns the envelope: composition (canvas), timeline (clock), assets
          (media catalog). Content is <code>layers[]</code> — not a{" "}
          <code>tracks[]</code> array on the authoring file.
        </P>
        <H2 id="clock">Clock vs lanes</H2>
        <P>
          <code>timeline.duration</code> is the MP4 length. Each root layer is a
          lane with <code>timing.start</code> and <code>timing.duration</code>.
          Child timing is local to its parent group. Audio is a root-only leaf.
        </P>
      </article>
    ),
  };
}
