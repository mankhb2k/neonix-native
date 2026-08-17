import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { ExampleWithResult } from "@/components/docs/figures/ExampleWithResult";
import { MediaFitFigure } from "@/components/docs/figures/MediaFitFigure";
import { VideoTrimFigure } from "@/components/docs/figures/VideoTrimFigure";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { visualLayerExample } from "@/lib/docs/content/layers/example-json";
import { DOCS_ASSET_VIDEO } from "@/lib/docs/visual-fixtures";
import { DocsTable, H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function videoLayerPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Video",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "payload", title: "Payload" },
      { id: "trim", title: "Trim vs timing" },
      { id: "example", title: "Example layer" },
      { id: "not-v1", title: "Not in V1" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Video"
          human="A video asset placed in a frame, with source playback control."
          jsonPath='layers[] type: "video"'
        />
        <P>
          <code>video</code> is a media layer with two halves: placement (how
          the video sits in its <code>frame</code> via <code>fit</code>) and
          playback (which part of the source plays via <code>trimStart</code> /{" "}
          <code>trimEnd</code>, <code>loop</code>, <code>muted</code>).
        </P>

        <H2 id="concept">Concept</H2>
        <MediaFitFigure caption="Placement works exactly like image. Default fit is cover." />

        <H2 id="payload">Payload</H2>
        <DocsTable
          headers={["Field", "Meaning"]}
          rows={[
            [<code key="a">assetId</code>, "The source video asset."],
            [
              <code key="f">fit</code>,
              "contain | cover | fill | none. Default cover.",
            ],
            [
              <code key="ts">trimStart</code>,
              "Optional. In-point inside the source, in seconds. May be 0.",
            ],
            [
              <code key="te">trimEnd</code>,
              "Optional. Out-point inside the source. Must be greater than trimStart.",
            ],
            [<code key="l">loop</code>, "Loop playback. Default false."],
            [
              <code key="m">muted</code>,
              "Mute the audio track. Default false.",
            ],
            [
              <code key="fp">framePolicy</code>,
              "Advanced. Do not emit unless the product path requires it.",
            ],
          ]}
        />

        <H2 id="trim">Trim vs timing</H2>
        <VideoTrimFigure />
        <P>
          <code>timing</code> still places the layer on the project timeline.
          Trim cuts the <em>source media</em> — it never changes{" "}
          <code>timing</code>.
        </P>

        <H2 id="example">Example layer</H2>
        <ExampleWithResult
          json={JSON.stringify(
            visualLayerExample({
              id: "video_1",
              type: "video",
              frame: { width: 1280, height: 720 },
              payload: {
                assetId: DOCS_ASSET_VIDEO.id,
                fit: "cover",
                trimStart: 0,
                trimEnd: 8,
                loop: false,
                muted: true,
              },
            }),
            null,
            2,
          )}
          result={
            <figure className="flex w-full max-w-[320px] flex-col items-center gap-2">
              <div
                className="overflow-hidden border border-dashed border-white/70 bg-black"
                style={{ width: 256, height: 144 }}
              >
                <video
                  src={`${DOCS_ASSET_VIDEO.uri}#t=0,8`}
                  muted
                  playsInline
                  autoPlay
                  loop
                  preload="metadata"
                  className="h-full w-full object-cover"
                  aria-label="Example video fitted with cover in a 16:9 frame"
                />
              </div>
              <figcaption className="font-mono text-[10px] text-[#94a3b8]">
                frame 1280×720 · fit cover · muted · {DOCS_ASSET_VIDEO.id}
              </figcaption>
            </figure>
          }
        />

        <H2 id="not-v1">Not in V1</H2>
        <P>
          No <code>payload.crop</code> — video V1 does not crop. To cut the
          picture use <code>fit</code>, <code>frame</code>, or a mask. No{" "}
          <code>style</code> on video.
        </P>

        <AiWritingGuide
          items={[
            "Reference the video with payload.assetId. Set frame as the display box.",
            "Trim cuts the source, not the layer lane. timing.start/duration still place the layer.",
            "If both trims are written, trimStart must be smaller than trimEnd.",
            "Do not emit payload.crop or style on a video layer.",
          ]}
        />
      </article>
    ),
  });
}
