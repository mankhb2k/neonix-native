import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { ExampleResultFrame } from "@/components/docs/figures/ExampleResultFrame";
import { ExampleWithResult } from "@/components/docs/figures/ExampleWithResult";
import { GroupFigure } from "@/components/docs/figures/GroupFigure";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { visualLayerExample } from "@/lib/docs/content/layers/example-json";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function groupLayerPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Group",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "what", title: "What a group is" },
      { id: "example", title: "Example layer" },
      { id: "not-v1", title: "Not in V1" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Group"
          human="A visual container that treats child layers as one unit."
          jsonPath='layers[] type: "group"'
        />
        <P>
          A group is valid only when it has children. It is not a leaf. Every
          child stays a full layer: its own <code>zIndex</code>,{" "}
          <code>timing</code>, and <code>transform</code>. The whole subtree
          stays inside the group&apos;s stacking slot at the parent scope.
          Always set <code>group.frame</code> — it is the layout box, not a clip
          rect.
        </P>

        <H2 id="concept">Concept</H2>
        <GroupFigure />

        <H2 id="what">What a group is</H2>
        <P>
          Group children. Apply transform to the subtree. Apply appearance,
          compositing, effects, and mask to the subtree. Limit the subtree
          lifetime with the group&apos;s own timing. It does not invent graphic
          content without children, rewrite a child&apos;s payload, or clip
          children to its box by default. Pack children with{" "}
          <code>layout</code> — see{" "}
          <a className="underline" href="/docs/layers/layout">
            Layout
          </a>
          .
        </P>

        <H2 id="example">Example layer</H2>
        <ExampleWithResult
          json={JSON.stringify(
            visualLayerExample({
              id: "hero",
              type: "group",
              frame: { width: 520, height: 200 },
              children: [
                {
                  id: "card",
                  type: "solid",
                  parentLayerId: "hero",
                  zIndex: 0,
                  timing: { start: 0, duration: 90 },
                  frame: { width: 520, height: 160 },
                  payload: { color: "#e8eef5" },
                },
              ],
            }),
            null,
            2,
          )}
          result={
            <ExampleResultFrame
              label="Rendered group with a solid child"
              caption="group frame 520×200 · child solid 520×160"
              viewBox="0 0 400 180"
            >
              <rect
                x={50}
                y={16}
                width={300}
                height={130}
                fill="none"
                stroke="#94a3b8"
                strokeDasharray="5 4"
              />
              <rect x={62} y={28} width={276} height={90} fill="#e8eef5" />
            </ExampleResultFrame>
          }
        />

        <H2 id="not-v1">Not in V1</H2>
        <P>
          Empty groups are invalid. Frame is not auto-derived from children. No
          default clip-to-group-box.
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
