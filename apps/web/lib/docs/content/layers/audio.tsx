import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { ExampleResultFrame } from "@/components/docs/figures/ExampleResultFrame";
import { ExampleWithResult } from "@/components/docs/figures/ExampleWithResult";
import { AudioFigure } from "@/components/docs/figures/AudioFigure";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { DocsTable, H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function audioLayerPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Audio",
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
          title="Audio"
          human="A root-only timeline sound object. Not a visual primitive."
          jsonPath='layers[] type: "audio"'
        />
        <P>
          Audio lives on <code>project.layers</code> with <code>timing</code>.
          No frame, transform, appearance, or layout.{" "}
          <code>parentLayerId</code> is always <code>null</code>.{" "}
          <code>zIndex</code> is required and negative.
        </P>

        <H2 id="concept">Concept</H2>
        <AudioFigure />

        <H2 id="payload">Payload</H2>
        <DocsTable
          headers={["Field", "Meaning"]}
          rows={[
            [<code key="a">assetId</code>, "The source audio asset."],
            [<code key="v">volume</code>, "0..100."],
            [<code key="m">muted</code>, "Mute. Default false."],
            [
              <code key="t">trimStart / trimEnd</code>,
              "Cut the source file, not the layer lane.",
            ],
            [<code key="f">fadeIn / fadeOut</code>, "Seconds."],
            [<code key="l">loop</code>, "Default false."],
          ]}
        />

        <H2 id="example">Example layer</H2>
        <ExampleWithResult
          json={JSON.stringify(
            {
              id: "audio-bgm",
              type: "audio",
              parentLayerId: null,
              zIndex: -1,
              timing: { start: 0, duration: 8 },
              payload: {
                assetId: "bgm",
                trimStart: 0,
                volume: 80,
                fadeIn: 0.5,
                fadeOut: 1,
                loop: false,
                muted: false,
              },
            },
            null,
            2,
          )}
          result={
            <ExampleResultFrame
              label="Audio layer (no visual frame)"
              caption="root-only · zIndex -1 · volume 80 · duration 8s"
              viewBox="0 0 400 120"
            >
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
                <rect
                  key={i}
                  x={48 + i * 26}
                  y={56 - [12, 22, 32, 18, 28, 14, 24, 16, 30, 20, 12, 8][i] / 2}
                  width={8}
                  height={[12, 22, 32, 18, 28, 14, 24, 16, 30, 20, 12, 8][i]}
                  rx={2}
                  fill="#0d9488"
                />
              ))}
            </ExampleResultFrame>
          }
        />

        <H2 id="not-v1">Not in V1</H2>
        <P>
          No nested audio, no visual atoms on audio, no track types. Captions
          are group + text, not an audio subtype.
        </P>

        <AiWritingGuide
          items={[
            "Keep audio at the root with zIndex < 0.",
            "Do not nest audio in a group.",
            "Do not emit frame, transform, appearance, or layout on audio.",
            "Mute with payload.muted. Volume with payload.volume.",
          ]}
        />
      </article>
    ),
  });
}
