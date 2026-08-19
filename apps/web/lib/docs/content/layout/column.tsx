import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function layoutColumnPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Column",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "example", title: "Example" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Column"
          human="Pack children vertically, top to bottom."
          jsonPath='layout.mode = "column"'
        />
        <H2 id="concept">Concept</H2>
        <P>
          <code>mode: &quot;column&quot;</code> lays children out along the
          vertical axis. Main axis is vertical (↓), cross axis is horizontal.
          Use <code>gap</code> for spacing, <code>justify</code> to distribute
          on the main axis, <code>align</code> to position on the cross axis.
        </P>
        <H2 id="example">Example</H2>
        <P>Vertical stack — heading, card, CTA button aligned to end.</P>
        <JsonBlock
          code={JSON.stringify(
            {
              type: "group",
              frame: { width: 600, height: 400 },
              layout: {
                mode: "column",
                gap: 12,
                padding: 24,
                justify: "start",
                align: "stretch",
              },
              children: [
                {
                  id: "heading",
                  type: "text",
                  frame: { width: 552, height: 48 },
                  layoutItem: { width: "fill", height: "hug" },
                },
                {
                  id: "card",
                  type: "solid",
                  frame: { width: 552, height: 200 },
                  layoutItem: { width: "fill", height: "fixed" },
                },
                {
                  id: "cta",
                  type: "shape",
                  frame: { width: 160, height: 48 },
                  layoutItem: {
                    width: "fixed",
                    height: "fixed",
                    alignSelf: "end",
                  },
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
