import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import { TranslateFigure } from "@/components/docs/figures/TransformFigures";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function translatePage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Translate",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "example", title: "Example" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Translate"
          human="Position in composition pixels."
          jsonPath="transform.translate"
        />
        <P>
          <code>translate.x</code> / <code>translate.y</code> move the layer in
          composition pixels. There is no <code>translate.z</code> — use{" "}
          <a className="underline" href="/docs/transform/depth">
            depth
          </a>{" "}
          for near/far.
        </P>

        <H2 id="concept">Concept</H2>
        <TranslateFigure />

        <H2 id="example">Example</H2>
        <JsonBlock
          caption="Authoring JSON (fragment)"
          code={JSON.stringify(
            { transform: { translate: { x: 960, y: 540 }, depth: 0 } },
            null,
            2,
          )}
        />

        <AiWritingGuide
          items={[
            "Use transform.translate.x/y for position. Never transform.x / transform.y.",
            "Use transform.depth for near/far — do not put z on translate.",
          ]}
        />
      </article>
    ),
  });
}
