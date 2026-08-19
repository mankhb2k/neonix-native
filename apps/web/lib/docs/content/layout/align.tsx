import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { DocsTable, H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function layoutAlignPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Align",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "values", title: "Values" },
      { id: "alignSelf", title: "alignSelf" },
      { id: "example", title: "Example" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Align"
          human="Position children on the cross axis."
          jsonPath="layout.align / layoutItem.alignSelf"
        />
        <H2 id="concept">Concept</H2>
        <P>
          <code>align</code> positions children on the cross axis (vertical for
          row, horizontal for column). Think CSS <code>align-items</code>.
        </P>
        <H2 id="values">Values</H2>
        <DocsTable
          headers={["Value", "Behavior"]}
          rows={[
            [<code key="s">start</code>, "Align to cross-axis start (default)."],
            [<code key="c">center</code>, "Center on the cross axis."],
            [<code key="e">end</code>, "Align to cross-axis end."],
            [
              <code key="st">stretch</code>,
              "Stretch to fill cross-axis space.",
            ],
          ]}
        />
        <H2 id="alignSelf">alignSelf</H2>
        <P>
          A child can override the parent <code>align</code> with{" "}
          <code>layoutItem.alignSelf</code>. Values: <code>auto</code> (inherit
          parent), <code>start</code>, <code>center</code>, <code>end</code>,{" "}
          <code>stretch</code>.
        </P>
        <H2 id="example">Example</H2>
        <JsonBlock
          code={JSON.stringify(
            {
              layout: { mode: "column", gap: 8, justify: "start", align: "stretch" },
              children: [
                {
                  id: "btn",
                  type: "shape",
                  frame: { width: 120, height: 40 },
                  layoutItem: { width: "fixed", height: "fixed", alignSelf: "end" },
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
