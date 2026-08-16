import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import { ExampleWithResult } from "@/components/docs/figures/ExampleWithResult";
import { MediaFitFigure } from "@/components/docs/figures/MediaFitFigure";
import type { DocsPageView } from "@/lib/docs/content/page-view";
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
            {
              id: "image_1",
              type: "image",
              parentLayerId: null,
              zIndex: 1,
              timing: { start: 0, duration: 90 },
              frame: { width: 400, height: 300 },
              transform: {
                translate: { x: 200, y: 120 },
                scale: { x: 1, y: 1 },
                rotate: { z: 0 },
                skew: { x: 0, y: 0 },
                origin: { x: 0.5, y: 0.5 },
                depth: 0,
              },
              appearance: { visible: true, opacity: 100 },
              payload: { assetId: "img_hero", fit: "cover" },
            },
            null,
            2,
          )}
          result={
            <svg
              viewBox="0 0 400 240"
              className="w-full max-w-[320px]"
              role="img"
              aria-label="Rendered image layer"
            >
              <defs>
                <clipPath id="img-ex">
                  <rect x={90} y={30} width={220} height={165} rx={4} />
                </clipPath>
              </defs>
              <rect
                x={90}
                y={30}
                width={220}
                height={165}
                fill="none"
                stroke="#94a3b8"
                strokeDasharray="5 4"
              />
              <g clipPath="url(#img-ex)">
                <rect x={90} y={30} width={220} height={165} fill="#dbeafe" />
                <circle cx={280} cy={65} r={20} fill="#fbbf24" />
                <path
                  d="M90 195 L160 100 L220 155 L260 120 L310 195 Z"
                  fill="#34d399"
                />
              </g>
              <text
                x={200}
                y={222}
                textAnchor="middle"
                fontSize={11}
                fill="#94a3b8"
                fontFamily="monospace"
              >
                frame 400×300 · fit cover
              </text>
            </svg>
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
