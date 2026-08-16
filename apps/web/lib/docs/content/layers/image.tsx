import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { ExampleWithResult } from "@/components/docs/figures/ExampleWithResult";
import { MediaFitFigure } from "@/components/docs/figures/MediaFitFigure";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { visualLayerExample } from "@/lib/docs/content/layers/example-json";
import { DOCS_ASSET_PHOTO_WIDE } from "@/lib/docs/visual-fixtures";
import { DocsTable, H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function imageLayerPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Image",
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
          title="Image"
          human="A bitmap asset shown in a frame."
          jsonPath='layers[] type: "image"'
        />
        <P>
          <code>image</code> is a visual leaf that displays a bitmap asset. The
          source is <code>payload.assetId</code>, the box is <code>frame</code>,
          how the bitmap sits in the box is <code>payload.fit</code>, and an
          optional <code>payload.crop</code> picks a region of the source.
        </P>

        <H2 id="concept">Concept</H2>
        <MediaFitFigure caption="Default fit is cover: keep the aspect ratio, fill the frame, allow cropping at the edges." />

        <H2 id="payload">Payload</H2>
        <DocsTable
          headers={["Field", "Meaning"]}
          rows={[
            [<code key="a">assetId</code>, "The source image asset."],
            [
              <code key="f">fit</code>,
              "contain | cover | fill | none. Default cover.",
            ],
            [
              <code key="c">crop</code>,
              "Optional. Normalized 0..1 region of the source: x, y, width, height. Does not change frame.",
            ],
          ]}
        />

        <H2 id="example">Example layer</H2>
        <ExampleWithResult
          json={JSON.stringify(
            visualLayerExample({
              id: "image_1",
              type: "image",
              frame: { width: 400, height: 300 },
              payload: { assetId: DOCS_ASSET_PHOTO_WIDE.id, fit: "cover" },
            }),
            null,
            2,
          )}
          result={
            <figure className="flex w-full max-w-[320px] flex-col items-center gap-2">
              <div
                className="overflow-hidden border border-dashed border-[#94a3b8]"
                style={{ width: 240, height: 180 }}
              >
                <img
                  src={DOCS_ASSET_PHOTO_WIDE.uri}
                  alt="16:9 photo fitted with cover in a 4:3 frame"
                  className="h-full w-full object-cover"
                />
              </div>
              <figcaption className="font-mono text-[10px] text-[#94a3b8]">
                frame 400×300 · fit cover · {DOCS_ASSET_PHOTO_WIDE.id}
              </figcaption>
            </figure>
          }
        />

        <H2 id="not-v1">Not in V1</H2>
        <P>
          No <code>style</code> / <code>fill</code> / <code>stroke</code> on
          image. No auto-detect of non-transparent bounds — a transparent PNG
          still fits by its full asset rectangle. No{" "}
          <code>object-position</code>. No <code>radius</code> on the image
          payload — rounded corners come from a mask or another shape.
        </P>

        <AiWritingGuide
          items={[
            "Reference the bitmap with payload.assetId. Set frame as the display box.",
            "Default fit is cover. Use contain when the whole image must stay visible.",
            "crop selects a source region in 0..1 — it never changes frame.",
            "Do not emit style, fill, stroke, or radius on an image layer.",
          ]}
        />
      </article>
    ),
  });
}
