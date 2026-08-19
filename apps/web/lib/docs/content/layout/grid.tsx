import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function layoutGridPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Grid",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "example", title: "Example" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Grid"
          human="Pack children into a fixed-column grid, left to right, top to bottom."
          jsonPath='layout.mode = "grid"'
        />
        <H2 id="concept">Concept</H2>
        <P>
          <code>mode: &quot;grid&quot;</code> arranges children into a grid with
          a fixed number of <code>columns</code> (1..32). Items flow
          left-to-right, then wrap to the next row. <code>gap</code> applies
          equally between rows and columns. No separate row/column gap in V1.
        </P>
        <H2 id="example">Example</H2>
        <P>2-column grid — 4 cells, gap 16, padding 16.</P>
        <JsonBlock
          code={JSON.stringify(
            {
              type: "group",
              frame: { width: 800, height: 600 },
              layout: {
                mode: "grid",
                columns: 2,
                gap: 16,
                padding: 16,
                justify: "start",
                align: "stretch",
              },
              children: [
                {
                  id: "cell-1",
                  type: "solid",
                  frame: { width: 376, height: 200 },
                  layoutItem: { width: "fill", height: "fixed" },
                },
                {
                  id: "cell-2",
                  type: "solid",
                  frame: { width: 376, height: 200 },
                  layoutItem: { width: "fill", height: "fixed" },
                },
                {
                  id: "cell-3",
                  type: "solid",
                  frame: { width: 376, height: 200 },
                  layoutItem: { width: "fill", height: "fixed" },
                },
                {
                  id: "cell-4",
                  type: "solid",
                  frame: { width: 376, height: 200 },
                  layoutItem: { width: "fill", height: "fixed" },
                },
              ],
            },
            null,
            2,
          )}
        />
      </article>
    ),
  });
}
