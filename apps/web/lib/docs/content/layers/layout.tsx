import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import { LayoutFigure } from "@/components/docs/figures/LayoutFigure";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { DocsTable, H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function layoutPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Layout",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "what", title: "What layout is" },
      { id: "modes", title: "Modes" },
      { id: "fields", title: "Layout fields" },
      { id: "layout-item", title: "layoutItem" },
      { id: "who", title: "Who may use it" },
      { id: "row-example", title: "Row example" },
      { id: "column-example", title: "Column example" },
      { id: "grid-example", title: "Grid example" },
      { id: "not-v1", title: "Not in V1" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Layout"
          human="How a group packs children. Not a layer type."
          jsonPath="group.layout / child.layoutItem"
        />

        <H2 id="concept">Concept</H2>
        <LayoutFigure />

        <H2 id="what">What layout is</H2>
        <P>
          <code>layout</code> is the packing rule on a group — container
          behavior, not <code>type: &quot;layout&quot;</code>.{" "}
          <code>layoutItem</code> is how a child opts into that rule. The
          compiler bakes the result into <code>frame</code> and{" "}
          <code>transform.translate</code>, then drops both fields before
          runtime.
        </P>

        <H2 id="modes">Modes</H2>
        <P>
          Three modes: <code>row</code>, <code>column</code>, and{" "}
          <code>grid</code>. All use the same <code>gap</code>,{" "}
          <code>padding</code>, <code>justify</code>, and <code>align</code>.
        </P>

        <DocsTable
          headers={["Mode", "Main axis", "Cross axis"]}
          rows={[
            [
              <code key="r">row</code>,
              "Horizontal →",
              "Vertical",
            ],
            [
              <code key="c">column</code>,
              "Vertical ↓",
              "Horizontal",
            ],
            [
              <code key="g">grid</code>,
              <>
                Left → right, top ↓ bottom. Needs{" "}
                <code>columns</code>.
              </>,
              "Per-cell alignment",
            ],
          ]}
        />

        <H2 id="fields">Layout fields</H2>
        <DocsTable
          headers={["Field", "Type", "Meaning"]}
          rows={[
            [
              <code key="m">mode</code>,
              <code key="mt">row | column | grid</code>,
              "Required. Packing direction.",
            ],
            [
              <code key="g">gap</code>,
              "number ≥ 0",
              "Space between children, in pixels. Default 0.",
            ],
            [
              <code key="p">padding</code>,
              "number | {top,right,bottom,left}",
              "Inset from group frame edge. Default 0.",
            ],
            [
              <code key="j">justify</code>,
              <code key="jt">start | center | end | space-between</code>,
              "Main-axis distribution. Default start.",
            ],
            [
              <code key="a">align</code>,
              <code key="at">start | center | end | stretch</code>,
              "Cross-axis alignment. Default start.",
            ],
            [
              <code key="col">columns</code>,
              "integer 1..32",
              "Grid only. Number of columns.",
            ],
          ]}
        />

        <H2 id="layout-item">layoutItem</H2>
        <P>
          Each child can set <code>layoutItem</code> to control how it
          participates in the parent layout.
        </P>
        <DocsTable
          headers={["Field", "Type", "Meaning"]}
          rows={[
            [
              <code key="w">width</code>,
              <code key="wt">fixed | hug | fill</code>,
              "How width is resolved. fixed = frame.width. hug = content. fill = stretch to available.",
            ],
            [
              <code key="h">height</code>,
              <code key="ht">fixed | hug | fill</code>,
              "Same for height.",
            ],
            [
              <code key="as">alignSelf</code>,
              <code key="ast">auto | start | center | end | stretch</code>,
              "Override parent align for this child.",
            ],
            [
              <code key="mnw">minWidth / maxWidth</code>,
              "number ≥ 0",
              "Clamp resolved width.",
            ],
            [
              <code key="mnh">minHeight / maxHeight</code>,
              "number ≥ 0",
              "Clamp resolved height.",
            ],
          ]}
        />

        <H2 id="who">Who may use it</H2>
        <P>
          Only <code>type: &quot;group&quot;</code> may have <code>layout</code>
          . Only nested visual children may have <code>layoutItem</code>. Audio
          and root layers cannot. The group <code>frame</code> is required —
          layout packs inside that box.
        </P>

        <H2 id="row-example">Row example</H2>
        <P>Horizontal row — 3 items, gap 16, center-aligned.</P>
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

        <H2 id="column-example">Column example</H2>
        <P>Vertical stack — padding 24, justify start, align stretch.</P>
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

        <H2 id="grid-example">Grid example</H2>
        <P>2-column grid — gap 16, padding 16.</P>
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

        <H2 id="not-v1">Not in V1</H2>
        <P>
          No <code>wrap</code>, <code>grow</code>, <code>shrink</code>,{" "}
          <code>span</code>, or separate row/column gaps. Grid flows
          left-to-right, top-to-bottom only. No <code>order</code> field.
        </P>

        <AiWritingGuide
          items={[
            "Put layout only on group. Put layoutItem only on children of that group.",
            "Use mode row, column, or grid. Size with fixed, hug, or fill — never content.",
            "Do not emit wrap, grow, shrink, span, or order.",
            "Grid requires columns (1..32). Flow is left→right, top→bottom.",
            "padding can be a number (all sides) or {top, right, bottom, left}.",
            "justify distributes on main axis: start, center, end, space-between.",
            "align positions on cross axis: start, center, end, stretch.",
            "Use alignSelf on layoutItem to override parent align for one child.",
          ]}
        />
      </article>
    ),
  });
}
