import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import { IsolationFigure } from "@/components/docs/figures/CompositingFigures";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function isolationPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Isolation",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "advanced", title: "Advanced field" },
      { id: "values", title: "Values" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Isolation"
          human="Whether this layer starts a new compositing group."
          jsonPath="compositing.isolation"
        />
        <H2 id="concept">Concept</H2>
        <IsolationFigure />
        <H2 id="advanced">Advanced field</H2>
        <P>
          Isolation stays in the schema because blend, mask, and effect scope
          need a consistent grouping rule. It is not a default authoring
          primitive. AI should not emit it unless the user needs a separate
          scope.
        </P>
        <H2 id="values">Values</H2>
        <P>
          Schema: <code>auto</code> or <code>isolate</code>. Default is{" "}
          <code>auto</code>. The engine uses that unless you set{" "}
          <code>isolate</code>.
        </P>
        <JsonBlock
          code={JSON.stringify(
            { compositing: { isolation: "isolate" } },
            null,
            2,
          )}
        />
        <AiWritingGuide
          items={[
            "Do not emit isolation by default.",
            "Set isolate only when blend, mask, or effects must be scoped.",
          ]}
        />
      </article>
    ),
  });
}
