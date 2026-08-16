import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import { ShapeFigure } from "@/components/docs/figures/ShapeFigure";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { DocsTable, H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function shapeLayerPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Shape",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "what", title: "What a shape is" },
      { id: "payload", title: "Payload" },
      { id: "paint", title: "Paint" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Shape"
          human="A formula primitive: rectangle, ellipse, or polygon. Not a freeform path."
          jsonPath='layers[] type: "shape"'
        />
        <H2 id="concept">Concept</H2>
        <ShapeFigure />
        <H2 id="what">What a shape is</H2>
        <P>
          Three parts: <code>frame</code> is the box, <code>payload</code> is
          which formula, <code>style</code> is paint. Transform, appearance,
          timing, and zIndex match every other visual layer.
        </P>
        <H2 id="payload">Payload</H2>
        <DocsTable
          headers={["shape", "Extra"]}
          rows={[
            [
              <code key="r">rectangle</code>,
              <>
                Optional <code>cornerRadius</code> in px of the frame
              </>,
            ],
            [
              <code key="e">ellipse</code>,
              "Circle = ellipse with a square frame",
            ],
            [
              <code key="p">polygon</code>,
              <>
                <code>points</code> min 3, each <code>x</code>/<code>y</code> in
                0..1 inside the frame
              </>,
            ],
          ]}
        />
        <JsonBlock
          code={JSON.stringify(
            {
              id: "plate",
              type: "shape",
              payload: { shape: "rectangle", cornerRadius: 24 },
              style: { fill: "#0d9488" },
            },
            null,
            2,
          )}
        />
        <H2 id="paint">Paint</H2>
        <P>
          Color lives on <code>style.fill</code> and <code>style.stroke</code>.
          Never <code>payload.color</code> — that field is for text and solid.
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
