import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import { LayoutFigure } from "@/components/docs/figures/LayoutFigure";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { DocsTable, H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function layoutOverviewPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Layout overview",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "what", title: "What layout is" },
      { id: "modes", title: "Modes" },
      { id: "who", title: "Who may use it" },
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
            [<code key="r">row</code>, "Horizontal →", "Vertical"],
            [<code key="c">column</code>, "Vertical ↓", "Horizontal"],
            [
              <code key="g">grid</code>,
              <>Left → right, top ↓ bottom. Needs <code>columns</code>.</>,
              "Per-cell alignment",
            ],
          ]}
        />

        <H2 id="who">Who may use it</H2>
        <P>
          Only <code>type: &quot;group&quot;</code> may have <code>layout</code>.
          Only nested visual children may have <code>layoutItem</code>. Audio and
          root layers cannot. The group <code>frame</code> is required — layout
          packs inside that box.
        </P>

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
          ]}
        />
      </article>
    ),
  });
}
