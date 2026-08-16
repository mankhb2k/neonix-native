import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { ExampleResultFrame } from "@/components/docs/figures/ExampleResultFrame";
import { ExampleWithResult } from "@/components/docs/figures/ExampleWithResult";
import { AdjustmentFigure } from "@/components/docs/figures/AdjustmentFigure";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { visualLayerExample } from "@/lib/docs/content/layers/example-json";
import { DocsTable, H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function adjustmentLayerPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Adjustment",
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
          title="Adjustment"
          human="A grade layer in the tree. Not effects[].type color-adjust."
          jsonPath='layers[] type: "adjustment"'
        />
        <P>
          <code>type: &quot;adjustment&quot;</code> is its own layer with frame
          and timing. <code>effects[].type = &quot;color-adjust&quot;</code>{" "}
          grades one existing layer. Do not swap the two.
        </P>

        <H2 id="concept">Concept</H2>
        <AdjustmentFigure />

        <H2 id="payload">Payload</H2>
        <DocsTable
          headers={["Field", "Meaning"]}
          rows={[
            [<code key="b">brightness</code>, "Percent. Identity 100."],
            [<code key="c">contrast</code>, "Percent. Identity 100."],
            [<code key="s">saturation</code>, "Percent. Identity 100."],
            [<code key="h">hue-rotate</code>, "Degrees. Identity 0."],
          ]}
        />

        <H2 id="example">Example layer</H2>
        <ExampleWithResult
          json={JSON.stringify(
            visualLayerExample({
              id: "grade-all",
              type: "adjustment",
              frame: { width: 1920, height: 1080 },
              payload: {
                brightness: 100,
                contrast: 110,
                saturation: 90,
                "hue-rotate": 0,
              },
            }),
            null,
            2,
          )}
          result={
            <ExampleResultFrame
              label="Adjustment layer"
              caption="contrast 110 · saturation 90 · not an effect"
              viewBox="0 0 400 140"
            >
              <rect
                x={40}
                y={20}
                width={320}
                height={88}
                fill="#e8eef5"
                stroke="#94a3b8"
                strokeDasharray="5 4"
              />
              <rect x={40} y={20} width={320} height={88} fill="#0d9488" opacity={0.18} />
            </ExampleResultFrame>
          }
        />

        <H2 id="not-v1">Not in V1</H2>
        <P>
          No exposure, gamma, vibrance, curves, or temperature. Do not use this
          type as a synonym for <code>effects.color-adjust</code>.
        </P>

        <AiWritingGuide
          items={[
            "Use type adjustment for a dedicated grade layer.",
            "Use effects color-adjust to grade one existing layer.",
            "Do not invent exposure, gamma, curves, or temperature.",
          ]}
        />
      </article>
    ),
  });
}
