import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function layoutRowPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Row",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "example", title: "Example" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Row"
          human="Pack children horizontally, left to right."
          jsonPath='layout.mode = "row"'
        />
        <H2 id="concept">Concept</H2>
        <P>
          <code>mode: &quot;row&quot;</code> lays children out along the
          horizontal axis. Main axis is horizontal (→), cross axis is vertical.
          Use <code>gap</code> for spacing, <code>justify</code> to distribute
          on the main axis, <code>align</code> to position on the cross axis.
        </P>
        <H2 id="example">Example</H2>
        <P>Horizontal row — icon, title (fill), badge. Gap 16, center-aligned.</P>
        <JsonBlock
          code={JSON.stringify(
            {
              type: "group",
              frame: { width: 800, height: 120 },
              layout: {
                mode: "row",
                gap: 16,
                padding: 0,
                justify: "start",
                align: "center",
              },
              children: [
                {
                  id: "icon",
                  type: "image",
                  frame: { width: 64, height: 64 },
                  layoutItem: { width: "fixed", height: "fixed" },
                },
                {
                  id: "title",
                  type: "text",
                  frame: { width: 400, height: 48 },
                  layoutItem: { width: "fill", height: "hug" },
                },
                {
                  id: "badge",
                  type: "shape",
                  frame: { width: 80, height: 32 },
                  layoutItem: { width: "fixed", height: "fixed" },
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
