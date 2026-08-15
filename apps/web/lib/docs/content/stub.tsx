import { HumanName } from "@/components/docs/HumanName";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { P } from "@/lib/docs/content/prose";

export function stubPage(title: string): DocsPageView {
  return {
    title,
    toc: [{ id: "overview", title: "Overview" }],
    body: (
      <article className="pb-20">
        <HumanName title={title} />
        <P>
          This page is a stub. Schema rules live in{" "}
          <code>@motionvideo/motion-protocol</code>. Do not invent fields. Write
          V1 JSON. Preview and export consume the compiled project.
        </P>
      </article>
    ),
  };
}
