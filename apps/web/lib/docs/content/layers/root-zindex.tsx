import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function rootZIndexPage(): DocsPageView {
  return withOnThisPage({
    title: "zIndex",
    toc: [
      { id: "lanes", title: "Root lanes" },
      { id: "nested", title: "Nested stacking" },
      { id: "unique", title: "Unique among siblings" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="zIndex"
          human="Lane order at the root. Paint order among siblings inside a group."
          jsonPath="layers[].zIndex"
        />
        <P>
          Every layer must have an integer <code>zIndex</code>. It is never
          optional. Missing values are invalid. Do not use{" "}
          <code>transform.depth</code> as a substitute.
        </P>
        <H2 id="lanes">Root lanes</H2>
        <P>
          Root layers (<code>parentLayerId: null</code>) are timeline lanes.
          Visual roots use <code>zIndex &gt;= 0</code>. Audio is root-only and
          uses <code>zIndex &lt; 0</code> (typically <code>-1</code>,{" "}
          <code>-2</code>, …). A group at root <code>zIndex: 2</code> paints
          its entire subtree between root 1 and root 3.
        </P>
        <JsonBlock
          code={JSON.stringify(
            {
              layers: [
                { id: "music", type: "audio", parentLayerId: null, zIndex: -1 },
                { id: "bg", type: "solid", parentLayerId: null, zIndex: 0 },
                { id: "hero", type: "group", parentLayerId: null, zIndex: 1 },
                { id: "title", type: "text", parentLayerId: null, zIndex: 2 },
              ],
            },
            null,
            2,
          )}
        />
        <H2 id="nested">Nested stacking</H2>
        <P>
          Nested visual layers also have <code>zIndex</code>, always{" "}
          <code>&gt;= 0</code>. That number only orders siblings inside the
          same parent. A child with <code>zIndex: 99</code> cannot jump above a
          root lane that sits on top of its parent group.
        </P>
        <H2 id="unique">Unique among siblings</H2>
        <P>
          Within one sibling set (same <code>parentLayerId</code>, including
          root <code>null</code>), each <code>zIndex</code> must be unique.
          Different parents may reuse the same number.
        </P>
        <AiWritingGuide
          items={[
            "Give every layer a zIndex. Do not omit it.",
            "Root visual: >= 0. Root audio: < 0. Nested: always >= 0.",
            "Keep zIndex unique among siblings of the same parent.",
          ]}
        />
      </article>
    ),
  });
}
