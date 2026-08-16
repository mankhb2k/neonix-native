import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { ExampleResultFrame } from "@/components/docs/figures/ExampleResultFrame";
import { ExampleWithResult } from "@/components/docs/figures/ExampleWithResult";
import { PathFigure } from "@/components/docs/figures/PathFigure";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { visualLayerExample } from "@/lib/docs/content/layers/example-json";
import { DocsTable, H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function pathLayerPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Path",
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
          title="Path"
          human="Freeform vector: points and segments. Not a formula shape."
          jsonPath='layers[] type: "path"'
        />
        <P>
          Use path for icons, cubics, holes, and several sub-paths in one layer.
          Use{" "}
          <a className="underline" href="/docs/layers/shape">
            shape
          </a>{" "}
          for rectangle, ellipse, and polygon. Color is{" "}
          <code>style.fill</code> / <code>style.stroke</code>.
        </P>

        <H2 id="concept">Concept</H2>
        <PathFigure />

        <H2 id="payload">Payload</H2>
        <DocsTable
          headers={["Field", "Meaning"]}
          rows={[
            [
              <code key="c">contours</code>,
              "Required. Each has id, start, segments (line | cubic), closed.",
            ],
            [
              <code key="f">fillRule</code>,
              "nonzero (default) or evenodd.",
            ],
            [
              <code key="m">morphTargets</code>,
              "Advanced. Must match base contour topology.",
            ],
          ]}
        />

        <H2 id="example">Example layer</H2>
        <ExampleWithResult
          json={JSON.stringify(
            visualLayerExample({
              id: "icon-path",
              type: "path",
              frame: { width: 200, height: 120 },
              payload: {
                contours: [
                  {
                    id: "c1",
                    start: { x: 20, y: 20 },
                    segments: [
                      { kind: "line", to: { x: 180, y: 20 } },
                      { kind: "line", to: { x: 180, y: 100 } },
                      { kind: "line", to: { x: 20, y: 100 } },
                    ],
                    closed: true,
                  },
                ],
                fillRule: "nonzero",
              },
              style: { fill: "#111111" },
            }),
            null,
            2,
          )}
          result={
            <ExampleResultFrame
              label="Rendered path layer"
              caption="frame 200×120 · 1 contour · fill #111111"
              viewBox="0 0 400 170"
            >
              <rect
                x={90}
                y={18}
                width={220}
                height={120}
                fill="none"
                stroke="#94a3b8"
                strokeDasharray="5 4"
              />
              <path
                d="M120 40 L280 40 L280 118 L120 118 Z"
                fill="#111111"
              />
            </ExampleResultFrame>
          }
        />

        <H2 id="not-v1">Not in V1</H2>
        <P>
          No SVG path string, no <code>payload.geometry</code>, no{" "}
          <code>payload.color</code>. Do not author a rectangle as a path.
        </P>

        <AiWritingGuide
          items={[
            "Do not stuff a rectangle into path. Use type shape.",
            "Give every contour a unique id. At least one contour.",
            "Color on style, not payload.color.",
          ]}
        />
      </article>
    ),
  });
}
