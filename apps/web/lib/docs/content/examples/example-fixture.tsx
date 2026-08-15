import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import { TimelineStrip, lanesFromProject } from "@/components/docs/TimelineStrip";
import type { DocsPageView } from "@/lib/docs/content/page-view";

export function exampleFixturePage(
  title: string,
  project: unknown,
): DocsPageView {
  const strip = lanesFromProject(project as never);
  return {
    title,
    previewProject: project,
    toc: [
      { id: "preview", title: "Preview" },
      { id: "json", title: "JSON" },
    ],
    body: (
      <article className="pb-20">
        <HumanName title={title} />
        <TimelineStrip lanes={strip.lanes} duration={strip.duration} />
        <JsonBlock code={JSON.stringify(project, null, 2)} />
      </article>
    ),
  };
}
