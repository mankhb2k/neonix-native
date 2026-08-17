import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { ExampleResultFrame } from "@/components/docs/figures/ExampleResultFrame";
import { ExampleWithResult } from "@/components/docs/figures/ExampleWithResult";
import { ShapeFigure } from "@/components/docs/figures/ShapeFigure";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { visualLayerExample } from "@/lib/docs/content/layers/example-json";
import { DocsTable, H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function shapeLayerPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Shape",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "payload", title: "Payload" },
      { id: "example", title: "Example layer" },
      { id: "not-v1", title: "Not in V1" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Shape"
          human="A formula primitive: rectangle, ellipse, or polygon. Not a freeform path."
          jsonPath='layers[] type: "shape"'
        />
        <P>
          Three parts: <code>frame</code> is the box, <code>payload</code> is
          which formula, <code>style</code> is paint. Color lives on{" "}
          <code>style.fill</code> / <code>style.stroke</code>, never{" "}
          <code>payload.color</code>.
        </P>

        <H2 id="concept">Concept</H2>
        <ShapeFigure />

        <H2 id="payload">Payload</H2>
        <DocsTable
          headers={["Field", "Meaning"]}
          rows={[
            [
              <code key="s">shape</code>,
              "rectangle | ellipse | polygon. Required.",
            ],
            [
              <code key="r">cornerRadius</code>,
              "Optional. Rectangle only. Pixels of the frame.",
            ],
            [
              <code key="p">points</code>,
              "Polygon only. Min 3. Each x/y is 0..1 inside the frame.",
            ],
          ]}
        />

        <H2 id="example">Example layer</H2>
        <ExampleWithResult
          json={JSON.stringify(
            visualLayerExample({
              id: "plate",
              type: "shape",
              frame: { width: 400, height: 240 },
              payload: { shape: "rectangle", cornerRadius: 24 },
              style: { fill: "#0d9488" },
            }),
            null,
            2,
          )}
          result={
            <ExampleResultFrame
              label="Rendered shape layer"
              caption="frame 400×240 · rectangle · cornerRadius 24 · fill #0d9488"
              viewBox="0 0 400 180"
            >
              <rect
                x={70}
                y={20}
                width={260}
                height={130}
                rx={16}
                fill="#0d9488"
                stroke="#f1f5f9"
                strokeDasharray="5 4"
              />
            </ExampleResultFrame>
          }
        />

        <H2 id="not-v1">Not in V1</H2>
        <P>
          No star / boolean-ops / custom path data on shape. Freeform vector is{" "}
          <a className="underline" href="/docs/layers/path">
            path
          </a>
          . No <code>payload.color</code>. No rounded ellipse.
        </P>

        <AiWritingGuide
          items={[
            "Use shape for boxes, circles, and simple polygons. Use path for Bezier and holes.",
            "Put color on style.fill or style.stroke. Never payload.color.",
            "Polygon points are 0..1 in the frame, not composition pixels.",
          ]}
        />
      </article>
    ),
  });
}
