import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function layoutPage(): DocsPageView {
  return withOnThisPage({
    title: "Layout",
    toc: [
      { id: "what", title: "What layout is" },
      { id: "who", title: "Who may use it" },
      { id: "fields", title: "Production fields" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Layout"
          human="How a group arranges its children. Not a modifier, not a frame."
          jsonPath="group.layout / child.layoutItem"
        />
        <H2 id="what">What layout is</H2>
        <P>
          <code>layout</code> is the packing rule on a group.{" "}
          <code>layoutItem</code> is how a child opts into that rule. The
          compiler bakes the result into <code>frame</code> and{" "}
          <code>transform.translate</code>, then drops both fields before
          runtime.
        </P>
        <JsonBlock
          code={JSON.stringify(
            {
              type: "group",
              frame: { width: 800, height: 400 },
              layout: {
                mode: "column",
                gap: 16,
                padding: 24,
                justify: "start",
                align: "stretch",
              },
              children: [
                {
                  type: "text",
                  frame: { width: 800, height: 48 },
                  layoutItem: { width: "fill", height: "hug" },
                },
              ],
            },
            null,
            2,
          )}
        />
        <H2 id="who">Who may use it</H2>
        <P>
          Only <code>type: &quot;group&quot;</code> may have{" "}
          <code>layout</code>. Only nested visual children may have{" "}
          <code>layoutItem</code>. Audio and root layers cannot. The group{" "}
          <code>frame</code> is required — layout packs inside that box.
        </P>
        <H2 id="fields">Production fields</H2>
        <P>
          Safe subset: <code>mode</code> row / column / grid,{" "}
          <code>gap</code>, <code>padding</code>, <code>justify</code>,{" "}
          <code>align</code>, item size <code>fixed</code> / <code>hug</code> /{" "}
          <code>fill</code>, <code>alignSelf</code>, min/max size. Grid needs{" "}
          <code>columns</code> and flows left-to-right, top-to-bottom. v1
          rejects <code>wrap</code>, <code>grow</code>, <code>shrink</code>,
          span, and separate row/column gaps.
        </P>
        <AiWritingGuide
          items={[
            "Put layout only on group. Put layoutItem only on children of that group.",
            "Use mode row, column, or grid. Size with fixed, hug, or fill — never content.",
            "Do not emit layout modifiers, wrap, grow, or shrink.",
          ]}
        />
      </article>
    ),
  });
}
