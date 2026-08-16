import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function groupLayerPage(): DocsPageView {
  return withOnThisPage({
    title: "Group",
    toc: [
      { id: "what", title: "What a group is" },
      { id: "jobs", title: "Four jobs" },
      { id: "not", title: "What it is not" },
      { id: "frame", title: "Group vs frame" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Group"
          human="A visual container that treats child layers as one unit."
          jsonPath='layers[] type: "group"'
        />
        <H2 id="what">What a group is</H2>
        <P>
          A group is valid only when it has children. It is not a leaf. Every
          child stays a full layer: its own <code>zIndex</code>,{" "}
          <code>timing</code>, and <code>transform</code>. The whole subtree
          stays inside the group&apos;s stacking slot at the parent scope.
        </P>
        <JsonBlock
          code={JSON.stringify(
            {
              id: "hero",
              type: "group",
              parentLayerId: null,
              zIndex: 1,
              timing: { start: 0, duration: 6 },
              frame: { width: 520, height: 200 },
              children: [
                {
                  id: "card",
                  type: "solid",
                  parentLayerId: "hero",
                  zIndex: 0,
                  timing: { start: 0, duration: 6 },
                  frame: { width: 520, height: 160 },
                },
              ],
            },
            null,
            2,
          )}
        />
        <H2 id="jobs">Four jobs</H2>
        <P>
          Group children. Apply transform to the subtree. Apply appearance,
          compositing, effects, and mask to the subtree. Limit the subtree
          lifetime with the group&apos;s own timing.
        </P>
        <H2 id="not">What it is not</H2>
        <P>
          A group does not invent graphic content without children. It does not
          rewrite a child&apos;s shape, text, or media. It does not clip
          children to its box by default. It does not replace a child&apos;s
          own animation.
        </P>
        <H2 id="frame">Group vs frame</H2>
        <P>
          A group must have a <code>frame</code> for its own box; that box
          does not clip children. Do not derive it from children in canonical
          JSON. Want a cut-out? Use a mask. Want children packed in a row,
          column, or grid? Set <code>layout</code> on the group and{" "}
          <code>layoutItem</code> on children.
        </P>
        <AiWritingGuide
          items={[
            "Never emit an empty group.",
            "Give every child zIndex and timing. Child timing stays inside the group window.",
            "Always set group.frame. It is the layout box, not a clip rect.",
            "Use compositing.mask to cut. Prefer mode clip or alpha and source-visibility mask-only.",
            "Use group.layout plus child.layoutItem to pack children.",
          ]}
        />
      </article>
    ),
  });
}
