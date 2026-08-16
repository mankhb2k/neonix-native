import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { ExampleResultFrame } from "@/components/docs/figures/ExampleResultFrame";
import { ExampleWithResult } from "@/components/docs/figures/ExampleWithResult";
import { MediaFitFigure } from "@/components/docs/figures/MediaFitFigure";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { visualLayerExample } from "@/lib/docs/content/layers/example-json";
import { DocsTable, H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function svgLayerPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "SVG",
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
          title="SVG"
          human="Place an SVG asset in a frame. Do not edit the file’s internals."
          jsonPath='layers[] type: "svg"'
        />
        <P>
          Image is a bitmap. Path and shape are authored geometry. SVG is a
          vector file referenced by <code>payload.assetId</code>. Optional{" "}
          <code>style.fill</code> is a simple recolor.
        </P>

        <H2 id="concept">Concept</H2>
        <MediaFitFigure caption="An SVG asset placed in its frame. Default fit is contain — logos and icons usually sit fully inside the box." />

        <H2 id="payload">Payload</H2>
        <DocsTable
          headers={["Field", "Meaning"]}
          rows={[
            [<code key="a">assetId</code>, "The source SVG asset."],
            [
              <code key="f">fit</code>,
              "contain | cover | fill | none. Default contain.",
            ],
          ]}
        />

        <H2 id="example">Example layer</H2>
        <ExampleWithResult
          json={JSON.stringify(
            visualLayerExample({
              id: "logo-svg",
              type: "svg",
              frame: { width: 240, height: 240 },
              payload: { assetId: "svg-logo", fit: "contain" },
              style: { fill: "#111111" },
            }),
            null,
            2,
          )}
          result={
            <ExampleResultFrame
              label="Rendered SVG layer"
              caption="frame 240×240 · fit contain · style.fill #111111"
              viewBox="0 0 400 200"
            >
              <rect
                x={110}
                y={20}
                width={180}
                height={150}
                fill="none"
                stroke="#94a3b8"
                strokeDasharray="5 4"
              />
              <path
                d="M200 40 L270 150 L130 150 Z"
                fill="none"
                stroke="#111111"
                strokeWidth={3}
                strokeLinejoin="round"
              />
            </ExampleResultFrame>
          }
        />

        <H2 id="not-v1">Not in V1</H2>
        <P>
          No crop, no node selectors, no stroke override, no editing SVG
          internals. Multi-color files may ignore <code>style.fill</code>.
        </P>

        <AiWritingGuide
          items={[
            "Use type svg for an SVG asset. Do not convert it to path contours.",
            "Default fit is contain. Image default is cover.",
            "Do not emit crop, payload.color, or node selectors.",
          ]}
        />
      </article>
    ),
  });
}
