import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { DocsTable, H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function layoutGapPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Gap",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "values", title: "Values" },
      { id: "example", title: "Example" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Gap"
          human="Space between children in a layout group."
          jsonPath="layout.gap"
        />
        <H2 id="concept">Concept</H2>
        <P>
          <code>gap</code> is the spacing between adjacent children along the
          main axis (and between rows in grid). It applies uniformly — V1 does
          not support separate row/column gaps.
        </P>
        <H2 id="values">Values</H2>
        <DocsTable
          headers={["Type", "Range", "Default"]}
          rows={[["number", "≥ 0 (pixels)", "0"]]}
        />
        <H2 id="example">Example</H2>
        <P>Row with gap 24 between 3 items.</P>
        <JsonBlock
          code={JSON.stringify(
            {
              layout: { mode: "row", gap: 24, align: "center", justify: "start" },
            },
            null,
            2,
          )}
        />
      </article>
    ),
  });
}
