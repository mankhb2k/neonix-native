import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { DocsTable, H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function layoutJustifyPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Justify",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "values", title: "Values" },
      { id: "example", title: "Example" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Justify"
          human="Distribute children along the main axis."
          jsonPath="layout.justify"
        />
        <H2 id="concept">Concept</H2>
        <P>
          <code>justify</code> controls how children are distributed along the
          main axis (horizontal for row, vertical for column). Think CSS{" "}
          <code>justify-content</code>.
        </P>
        <H2 id="values">Values</H2>
        <DocsTable
          headers={["Value", "Behavior"]}
          rows={[
            [<code key="s">start</code>, "Pack children at the start (default)."],
            [<code key="c">center</code>, "Center children in available space."],
            [<code key="e">end</code>, "Pack children at the end."],
            [
              <code key="sb">space-between</code>,
              "First child at start, last at end, equal space between.",
            ],
          ]}
        />
        <H2 id="example">Example</H2>
        <JsonBlock
          code={JSON.stringify(
            {
              layout: {
                mode: "row",
                gap: 0,
                justify: "space-between",
                align: "center",
              },
            },
            null,
            2,
          )}
        />
      </article>
    ),
  });
}
