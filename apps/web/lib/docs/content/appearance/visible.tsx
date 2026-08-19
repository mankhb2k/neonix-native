import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { ExampleWithResult } from "@/components/docs/figures/ExampleWithResult";
import {
  TransformExamplePhoto,
  TransformExampleRow,
} from "@/components/docs/figures/TransformExamplePhoto";
import { VisibleFigure } from "@/components/docs/figures/CompositingFigures";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { squareImageLayerExample } from "@/lib/docs/content/layers/example-json";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function visiblePage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Visible",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "meaning", title: "Meaning" },
      { id: "example", title: "Example" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Visible"
          human="Whether the visual layer is rendered."
          jsonPath="opacity (use 0 to hide)"
        />
        <P>
          <code>opacity (use 0 to hide)</code> is render on/off for visual layers. It
          is not hit-test, selection, or editor lock. Audio has no appearance —
          mute with <code>payload.muted</code>.
        </P>

        <H2 id="concept">Concept</H2>
        <VisibleFigure />

        <H2 id="meaning">Meaning</H2>
        <P>
          <code>false</code> means the layer is not painted. Opacity can stay
          100. The JSON protocol does not define hit-test or UI selection from
          this field.
        </P>

        <H2 id="example">Example</H2>
        <ExampleWithResult
          json={JSON.stringify(
            squareImageLayerExample(
              {},
              { appearance: { visible: false, opacity: 100 } },
            ),
            null,
            2,
          )}
          result={
            <TransformExampleRow>
              <TransformExamplePhoto label="visible true" />
              <TransformExamplePhoto label="visible false" hidden />
            </TransformExampleRow>
          }
        />

        <AiWritingGuide
          items={[
            "Set opacity (use 0 to hide) on visual layers only.",
            "Do not emit pointer-events or hitTest fields.",
            "Do not use opacity (use 0 to hide) to mute audio.",
          ]}
        />
      </article>
    ),
  });
}
