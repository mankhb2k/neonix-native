import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { ExampleWithResult } from "@/components/docs/figures/ExampleWithResult";
import { MediaFitFigure } from "@/components/docs/figures/MediaFitFigure";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { visualLayerExample } from "@/lib/docs/content/layers/example-json";
import { DocsTable, H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";
import { DOCS_ASSET_TREE } from "@/lib/docs/visual-fixtures";

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
              payload: { assetId: DOCS_ASSET_TREE.id, fit: "contain" },
            }),
            null,
            2,
          )}
          result={
            <figure className="flex w-full max-w-[320px] flex-col items-center gap-2">
              <div
                className="overflow-hidden border border-dashed border-white/70 bg-white"
                style={{ width: 180, height: 180 }}
              >
                <img
                  src={DOCS_ASSET_TREE.uri}
                  alt="SVG asset fitted with contain"
                  className="h-full w-full object-contain"
                />
              </div>
              <figcaption className="font-mono text-[10px] text-[#94a3b8]">
                frame 240×240 · fit contain · {DOCS_ASSET_TREE.id}
              </figcaption>
            </figure>
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
