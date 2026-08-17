import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import { TimelineStrip, lanesFromProject } from "@/components/docs/TimelineStrip";
import { MINIMAL_EMPTY, SINGLE_ROOT } from "@/lib/docs/projects";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";

export function minimalProjectPage(): DocsPageView {
  const strip = lanesFromProject(SINGLE_ROOT);
  return {
    title: "Minimal project",
    toc: [
      { id: "empty", title: "Empty" },
      { id: "one-layer", title: "One text layer" },
      { id: "timeline", title: "Timeline" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Minimal project"
          jsonPath="format + composition + layers"
        />
        <P>
          Smallest valid project: empty <code>layers</code>. Smallest visual
          project: one root text layer with transform, frame, timing, payload.
        </P>
        <H2 id="empty">Empty</H2>
        <JsonBlock code={JSON.stringify(MINIMAL_EMPTY, null, 2)} />
        <H2 id="one-layer">One text layer</H2>
        <JsonBlock code={JSON.stringify(SINGLE_ROOT, null, 2)} />
        <TimelineStrip lanes={strip.lanes} duration={strip.duration} />
      </article>
    ),
  };
}
