import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { ExampleResultFrame } from "@/components/docs/figures/ExampleResultFrame";
import { ExampleWithResult } from "@/components/docs/figures/ExampleWithResult";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { visualLayerExample } from "@/lib/docs/content/layers/example-json";
import { DocsTable, H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function solidLayerPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Solid",
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
          title="Solid"
          human="A filled rectangle of one color. Background, card, or block."
          jsonPath='layers[] type: "solid"'
        />
        <P>
          Size is <code>frame</code>. Color is <code>payload.color</code>. Not a
          shape rectangle: no <code>style.fill</code>, no corner radius.
        </P>

        <H2 id="concept">Concept</H2>
        <P>
          Use solid as a plate. Need rounding or stroke →{" "}
          <a className="underline" href="/docs/layers/shape">
            shape
          </a>
          .
        </P>

        <H2 id="payload">Payload</H2>
        <DocsTable
          headers={["Field", "Meaning"]}
          rows={[
            [
              <code key="c">color</code>,
              <>
                <code>#rrggbb</code>. Default <code>#000000</code>.
              </>,
            ],
          ]}
        />

        <H2 id="example">Example layer</H2>
        <ExampleWithResult
          json={JSON.stringify(
            visualLayerExample({
              id: "bg-plate",
              type: "solid",
              frame: { width: 1920, height: 1080 },
              payload: { color: "#e8eef5" },
            }),
            null,
            2,
          )}
          result={
            <ExampleResultFrame
              label="Rendered solid layer"
              caption="frame 1920×1080 · payload.color #e8eef5"
              viewBox="0 0 400 160"
            >
              <rect
                x={40}
                y={16}
                width={320}
                height={110}
                fill="#e8eef5"
                stroke="#f1f5f9"
                strokeDasharray="5 4"
              />
            </ExampleResultFrame>
          }
        />

        <H2 id="not-v1">Not in V1</H2>
        <P>
          No <code>style</code>, no <code>cornerRadius</code> on solid. Gradient
          and image-fill are not solid.
        </P>

        <AiWritingGuide
          items={[
            "Use solid for a full-bleed plate or card fill.",
            "Put color on payload.color, not style.fill.",
            "Rounded plate = type shape rectangle + cornerRadius + style.fill.",
          ]}
        />
      </article>
    ),
  });
}
