import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import { CompositionFigure } from "@/components/docs/figures/ProjectFigures";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { DocsTable, H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function compositionPage(): DocsPageView {
  return withOnThisPage({
    title: "Composition",
    showToc: false,
    toc: [
      { id: "canvas", title: "Render face" },
      { id: "fields", title: "Fields" },
      { id: "vs-frame", title: "Not layer frame" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Composition"
          human="The canvas of the video — pixel size, fps, background. Not each layer’s box."
          jsonPath="composition"
        />
        <H2 id="canvas">Render face</H2>
        <P>
          Composition is the output frame. Together with derived project length
          it decides the MP4. It is not the size
          of a text or image layer.
        </P>
        <CompositionFigure />
        <H2 id="fields">Fields</H2>
        <DocsTable
          headers={["Field", "Rule"]}
          rows={[
            [
              <code key="wh">width / height</code>,
              "Pixels of the composition; must be > 0",
            ],
            [<code key="fps">fps</code>, "1…120"],
            [
              <code key="bg">background</code>,
              <>
                <code>#rrggbb</code>, default <code>#ffffff</code>
              </>,
            ],
            [
              <code key="cs">colorSpace</code>,
              <>
                MVP: only <code>&quot;srgb&quot;</code>
              </>,
            ],
            [
              <code key="asr">audioSampleRate</code>,
              <>
                <code>44100</code> or <code>48000</code>
              </>,
            ],
          ]}
        />
        <JsonBlock
          caption="9:16 vertical — size lives here, not on metadata."
          code={JSON.stringify(
            {
              composition: {
                width: 1080,
                height: 1920,
                fps: 30,
                background: "#ffffff",
                colorSpace: "srgb",
                audioSampleRate: 48000,
              },
            },
            null,
            2,
          )}
        />
        <H2 id="vs-frame">Not layer frame</H2>
        <P>
          <code>composition.width</code> ≠ <code>frame.width</code>. Frame is
          the layer’s own box (see Layers). A 400×80 title can sit on a
          1080×1920 composition.
        </P>
        <AiWritingGuide
          items={[
            "For 9:16 emit 1080×1920 on composition.",
            "Do not write aspectRatio on metadata (that was V2).",
          ]}
        />
      </article>
    ),
  });
}
