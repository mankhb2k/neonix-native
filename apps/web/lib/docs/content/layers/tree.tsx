import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function layerTreePage(): DocsPageView {
  return withOnThisPage({
    title: "Layer tree",
    toc: [
      { id: "roots", title: "Roots" },
      { id: "nesting", title: "Nesting" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Layer tree"
          human="Root list plus group.children. One parent pointer per child."
          jsonPath="layers[] / group.children[]"
        />
        <H2 id="roots">Roots</H2>
        <P>
          <code>project.layers[]</code> holds only roots. Each root has{" "}
          <code>parentLayerId: null</code>, required <code>zIndex</code>, and
          required <code>timing</code>.
        </P>
        <H2 id="nesting">Nesting</H2>
        <P>
          Only <code>type: &quot;group&quot;</code> may have{" "}
          <code>children</code>. A child&apos;s <code>parentLayerId</code> must
          equal the group id. Do not also list that child at the project root.
          Audio cannot nest.
        </P>
        <JsonBlock
          code={JSON.stringify(
            {
              id: "hero",
              type: "group",
              parentLayerId: null,
              zIndex: 1,
              timing: { start: 0, duration: 6 },
              children: [
                {
                  id: "card",
                  type: "solid",
                  parentLayerId: "hero",
                  zIndex: 0,
                  timing: { start: 0, duration: 6 },
                },
              ],
            },
            null,
            2,
          )}
        />
        <AiWritingGuide
          items={[
            "Only group has children, and a group must have at least one child.",
            "Child parentLayerId must match the group id.",
          ]}
        />
      </article>
    ),
  });
}
