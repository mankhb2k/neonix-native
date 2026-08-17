import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { ExampleWithResult } from "@/components/docs/figures/ExampleWithResult";
import { TextLayerFigure } from "@/components/docs/figures/TextLayerFigure";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { DocsTable, H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function textLayerPage(): DocsPageView {
  return withOnThisPage({ showToc: false,
    title: "Text",
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
          title="Text"
          human="One box, one run of text, one shared style."
          jsonPath="layers[].payload"
        />
        <P>
          <code>text</code> is a visual leaf. It renders one run of text with
          one shared style. Need two different styles → author two text layers.
          No rich text, no runs.
        </P>

        <H2 id="concept">Concept</H2>
        <TextLayerFigure />

        <H2 id="payload">Payload</H2>
        <DocsTable
          headers={["Field", "Meaning"]}
          rows={[
            [<code key="t">text</code>, "Text content. Required."],
            [<code key="f">fontAssetId</code>, "Font used to render."],
            [<code key="s">fontSize</code>, "Font size. Required."],
            [<code key="c">color</code>, "Text color. Default #000000."],
            [
              <code key="a">alignment</code>,
              "left | center | right. Default left.",
            ],
            [
              <code key="w">wrap</code>,
              "none | word | character. Default word.",
            ],
            [<code key="l">lineHeight</code>, "Line spacing."],
            [<code key="ls">letterSpacing</code>, "Letter spacing."],
            [<code key="m">maxLines</code>, "Maximum number of lines."],
            [
              <code key="o">overflow</code>,
              "visible | clip | ellipsis. Default clip.",
            ],
          ]}
        />

        <H2 id="example">Example layer</H2>
        <ExampleWithResult
          json={JSON.stringify(
            {
              id: "title_1",
              type: "text",
              parentLayerId: null,
              zIndex: 1,
              timing: { start: 0, duration: 90 },
              frame: { width: 800, height: 120 },
              transform: {
                translate: { x: 120, y: 80 },
                scale: { x: 1, y: 1 },
                rotate: { z: 0 },
                skew: { x: 0, y: 0 },
                origin: { x: 0.5, y: 0.5 },
                depth: 0,
              },
              appearance: { visible: true, opacity: 100 },
              payload: {
                text: "Hello world",
                fontAssetId: "font_inter",
                fontSize: 64,
                color: "#111111",
                alignment: "left",
                wrap: "word",
                lineHeight: 72,
                letterSpacing: 0,
                overflow: "clip",
              },
            },
            null,
            2,
          )}
          result={
            <svg
              viewBox="0 0 400 140"
              className="w-full max-w-[320px]"
              role="img"
              aria-label="Rendered text layer"
            >
              <rect
                x={8}
                y={14}
                width={384}
                height={112}
                rx={6}
                fill="#fff"
                stroke="#f1f5f9"
                strokeDasharray="5 4"
              />
              <text
                x={28}
                y={82}
                fontSize={44}
                fontWeight={600}
                fill="#111111"
                fontFamily="system-ui"
              >
                Hello world
              </text>
              <text
                x={28}
                y={112}
                fontSize={10}
                fill="#94a3b8"
                fontFamily="monospace"
              >
                frame 800×120 · fontSize 64 · color #111111
              </text>
            </svg>
          }
        />

        <H2 id="not-v1">Not in V1</H2>
        <P>
          <code>content.kind</code>, <code>runs</code>, <code>run.style</code>,
          rich text with multiple styles, per-word highlight, mixed fonts inside
          one text layer. Want one red word and one blue word → two text layers.
        </P>

        <AiWritingGuide
          items={[
            "Always provide text and fontSize in payload.",
            "One style per text layer — split into multiple layers for mixed styles.",
            "String props can bind into payload.text. See variables and bindings.",
          ]}
        />
      </article>
    ),
  });
}
