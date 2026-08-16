import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import { PathFigure } from "@/components/docs/figures/PathFigure";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function pathLayerPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Path",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "what", title: "What a path is" },
      { id: "contours", title: "Contours" },
      { id: "paint", title: "Paint" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Path"
          human="Freeform vector: points and segments. Not a formula shape."
          jsonPath='layers[] type: "path"'
        />
        <H2 id="concept">Concept</H2>
        <PathFigure />
        <H2 id="what">What a path is</H2>
        <P>
          Use path for icons, cubics, holes, and several sub-paths in one layer
          (letter O). Use{" "}
          <a className="underline" href="/docs/layers/shape">
            shape
          </a>{" "}
          for rectangle, ellipse, and polygon. There is no{" "}
          <code>payload.geometry</code> — contours sit on <code>payload</code>.
        </P>
        <H2 id="contours">Contours</H2>
        <P>
          Each contour has <code>id</code>, <code>start</code>,{" "}
          <code>segments</code> (<code>line</code> or <code>cubic</code>), and{" "}
          <code>closed</code>. <code>fillRule</code> is <code>nonzero</code>{" "}
          (default) or <code>evenodd</code>. <code>morphTargets</code> are
          advanced and must match base topology.
        </P>
        <JsonBlock
          code={JSON.stringify(
            {
              type: "path",
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
            },
            null,
            2,
          )}
        />
        <H2 id="paint">Paint</H2>
        <P>
          Same as shape: <code>style.fill</code> / <code>style.stroke</code>.
          Never <code>payload.color</code>.
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
