import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { DocsTable, H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function layoutItemPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Layout item",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "size-modes", title: "Size modes" },
      { id: "fields", title: "All fields" },
      { id: "example", title: "Example" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Layout item"
          human="How a child participates in its parent layout."
          jsonPath="layers[].layoutItem"
        />
        <H2 id="concept">Concept</H2>
        <P>
          <code>layoutItem</code> tells the layout engine how this child should
          be sized and aligned inside the parent group. Without it, the child
          uses its <code>frame</code> as-is.
        </P>
        <H2 id="size-modes">Size modes</H2>
        <DocsTable
          headers={["Mode", "Meaning"]}
          rows={[
            [
              <code key="f">fixed</code>,
              "Use the child's frame.width / frame.height exactly.",
            ],
            [
              <code key="h">hug</code>,
              "Shrink to content size (e.g. text wraps).",
            ],
            [
              <code key="fi">fill</code>,
              "Stretch to fill available space in the layout.",
            ],
          ]}
        />
        <H2 id="fields">All fields</H2>
        <DocsTable
          headers={["Field", "Type", "Meaning"]}
          rows={[
            [
              <code key="w">width</code>,
              <code key="wt">fixed | hug | fill</code>,
              "How width is resolved.",
            ],
            [
              <code key="h">height</code>,
              <code key="ht">fixed | hug | fill</code>,
              "How height is resolved.",
            ],
            [
              <code key="as">alignSelf</code>,
              <code key="ast">auto | start | center | end | stretch</code>,
              "Override parent align for this child.",
            ],
            [
              <code key="mnw">minWidth</code>,
              "number ≥ 0",
              "Minimum resolved width.",
            ],
            [
              <code key="mxw">maxWidth</code>,
              "number ≥ 0",
              "Maximum resolved width.",
            ],
            [
              <code key="mnh">minHeight</code>,
              "number ≥ 0",
              "Minimum resolved height.",
            ],
            [
              <code key="mxh">maxHeight</code>,
              "number ≥ 0",
              "Maximum resolved height.",
            ],
          ]}
        />
        <H2 id="example">Example</H2>
        <P>Text fills width, image stays fixed, button hugs content.</P>
        <JsonBlock
          code={JSON.stringify(
            {
              children: [
                {
                  id: "title",
                  type: "text",
                  frame: { width: 400, height: 48 },
                  layoutItem: { width: "fill", height: "hug" },
                },
                {
                  id: "avatar",
                  type: "image",
                  frame: { width: 64, height: 64 },
                  layoutItem: { width: "fixed", height: "fixed" },
                },
                {
                  id: "btn",
                  type: "text",
                  frame: { width: 100, height: 36 },
                  layoutItem: {
                    width: "hug",
                    height: "hug",
                    minWidth: 80,
                    maxWidth: 200,
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
