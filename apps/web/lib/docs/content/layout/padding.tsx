import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { DocsTable, H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function layoutPaddingPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Padding",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "values", title: "Values" },
      { id: "example", title: "Example" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Padding"
          human="Inset from group frame edge before packing children."
          jsonPath="layout.padding"
        />
        <H2 id="concept">Concept</H2>
        <P>
          <code>padding</code> is the inner spacing between the group frame edge
          and where children begin. It can be a single number (all sides equal)
          or an object with <code>top</code>, <code>right</code>,{" "}
          <code>bottom</code>, <code>left</code>.
        </P>
        <H2 id="values">Values</H2>
        <DocsTable
          headers={["Form", "Example"]}
          rows={[
            ["number", <code key="n">24</code>],
            [
              "object",
              <code key="o">{"{ top: 16, right: 24, bottom: 16, left: 24 }"}</code>,
            ],
          ]}
        />
        <H2 id="example">Example</H2>
        <P>Uniform padding of 24 and per-side padding.</P>
        <JsonBlock
          code={JSON.stringify(
            {
              uniform: { layout: { mode: "column", gap: 8, padding: 24 } },
              perSide: {
                layout: {
                  mode: "column",
                  gap: 8,
                  padding: { top: 32, right: 24, bottom: 32, left: 24 },
                },
              },
            },
            null,
            2,
          )}
        />
      </article>
    ),
  });
}
