import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { ExampleWithResult } from "@/components/docs/figures/ExampleWithResult";
import { SkewFigure } from "@/components/docs/figures/TransformFigures";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import {
  EXAMPLE_TRANSFORM,
  visualLayerExample,
} from "@/lib/docs/content/layers/example-json";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";
import { DOCS_ASSET_PHOTO_SQUARE } from "@/lib/docs/visual-fixtures";

function SkewPhoto({
  label,
  skew,
}: {
  label: string;
  skew: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="overflow-hidden border border-dashed border-[#94a3b8] bg-white"
        style={{ width: 96, height: 96 }}
      >
        <img
          src={DOCS_ASSET_PHOTO_SQUARE.uri}
          alt={label}
          className="h-full w-full object-cover"
          style={{ transform: skew, transformOrigin: "center" }}
        />
      </div>
      <p className="font-mono text-[10px] text-[#94a3b8]">{label}</p>
    </div>
  );
}

export function skewPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Skew",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "example", title: "Example" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Skew"
          human="Shear the local box, in degrees."
          jsonPath="transform.skew"
        />
        <P>
          <code>skew.x</code> and <code>skew.y</code> stay in V1. They apply
          around origin after scale/rotate in the transform pipeline. Not a
          layout or an effect.
        </P>

        <H2 id="concept">Concept</H2>
        <SkewFigure />

        <H2 id="example">Example</H2>
        <ExampleWithResult
          json={JSON.stringify(
            visualLayerExample({
              id: "photo",
              type: "image",
              frame: { width: 400, height: 400 },
              transform: {
                ...EXAMPLE_TRANSFORM,
                skew: { x: 16, y: 0 },
              },
              payload: {
                assetId: DOCS_ASSET_PHOTO_SQUARE.id,
                fit: "cover",
              },
            }),
            null,
            2,
          )}
          result={
            <div className="flex w-full max-w-[400px] items-start justify-center gap-6">
              <SkewPhoto label="0, 0" skew="none" />
              <SkewPhoto label="skew.x 16" skew="skewX(16deg)" />
              <SkewPhoto label="skew.y 12" skew="skewY(12deg)" />
            </div>
          }
        />

        <AiWritingGuide
          items={[
            "Use transform.skew.x/y. Do not emit a matrix field.",
            "Skew applies around origin, after scale/rotate.",
          ]}
        />
      </article>
    ),
  });
}
