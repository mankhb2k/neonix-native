import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import { MediaFitFigure } from "@/components/docs/figures/MediaFitFigure";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function svgLayerPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "SVG",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "what", title: "Not image, not path" },
      { id: "payload", title: "Payload" },
      { id: "style", title: "Recolor" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="SVG"
          human="Place an SVG asset in a frame. Do not edit the file’s internals."
          jsonPath='layers[] type: "svg"'
        />
        <H2 id="concept">Concept</H2>
        <MediaFitFigure caption="An SVG asset placed in its frame. Default fit is contain — logos and icons usually sit fully inside the box." />
        <H2 id="what">Not image, not path</H2>
        <P>
          Image is a bitmap. Path and shape are authored geometry. SVG is a
          vector file referenced by <code>payload.assetId</code>. V1 does not
          select nodes inside the SVG.
        </P>
        <H2 id="payload">Payload</H2>
        <P>
          <code>assetId</code> plus <code>fit</code>: contain (default), cover,
          fill, or none. No <code>crop</code>.
        </P>
        <JsonBlock
          code={JSON.stringify(
            {
              id: "logo-svg",
              type: "svg",
              payload: { assetId: "svg-logo", fit: "contain" },
              style: { fill: "#111111" },
            },
            null,
            2,
          )}
        />
        <H2 id="style">Recolor</H2>
        <P>
          Optional <code>style.fill</code> is a simple recolor for single-color
          icons. Multi-color SVGs may not recolor as expected. No stroke
          override, no CSS selectors.
        </P>
        <AiWritingGuide
          items={[
            "Use type svg for an SVG asset. Do not convert it to path contours.",
            "Default fit is contain. Image default is cover.",
            "Do not emit crop, payload.color, or node selectors.",
          ]}
        />
      </article>
    ),
  });
}
