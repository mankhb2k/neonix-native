import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { ExampleWithResult } from "@/components/docs/figures/ExampleWithResult";
import {
  TransformExamplePhoto,
  TransformExampleRow,
} from "@/components/docs/figures/TransformExamplePhoto";
import { DepthFigure } from "@/components/docs/figures/TransformFigures";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { squareImageLayerExample } from "@/lib/docs/content/layers/example-json";
import { DocsTable, H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function depthPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Depth",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "vs-zindex", title: "Depth vs zIndex" },
      { id: "example", title: "Example" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Depth"
          human="Near/far for pseudo-3D and parallax."
          jsonPath="transform.depth"
        />
        <P>
          <code>0</code> is the normal plane. Positive values come closer,
          negative values go farther. Depth never changes paint order.
        </P>

        <H2 id="concept">Concept</H2>
        <DepthFigure />

        <H2 id="vs-zindex">Depth vs zIndex</H2>
        <DocsTable
          headers={["", "zIndex", "depth"]}
          rows={[
            ["Job", "Lane / paint order", "Position in space"],
            [
              "Rule",
              "Higher paints on top, same sibling scope",
              "Geometry / camera / parallax",
            ],
            ["Not", "Not a Z position", "Does not change paint order"],
          ]}
        />

        <H2 id="example">Example</H2>
        <ExampleWithResult
          json={JSON.stringify(
            squareImageLayerExample({ depth: 120 }),
            null,
            2,
          )}
          result={
            <TransformExampleRow>
              <TransformExamplePhoto
                label="depth -200"
                transform="scale(0.72)"
              />
              <TransformExamplePhoto label="0" transform="none" />
              <TransformExamplePhoto
                label="depth +120"
                transform="scale(1.28)"
              />
            </TransformExampleRow>
          }
        />

        <AiWritingGuide
          items={[
            "Use transform.depth for parallax and pseudo-3D.",
            "Never invent transform.z.",
            "Keep zIndex for paint order. Do not use zIndex for parallax.",
          ]}
        />
      </article>
    ),
  });
}
