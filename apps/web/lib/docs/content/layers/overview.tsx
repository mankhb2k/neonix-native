import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { TypeGlyphsFigure } from "@/components/docs/figures/TypeGlyphsFigure";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { DocsTable, H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function layerTypesOverviewPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Layer types overview",
    toc: [
      { id: "map", title: "Type map" },
      { id: "not-types", title: "Not a type" },
      { id: "advanced", title: "Advanced" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Layer types overview"
          human="Discriminator is type. Layout is not a type."
          jsonPath="layers[].type"
        />
        <H2 id="map">Type map</H2>
        <TypeGlyphsFigure />
        <DocsTable
          headers={["type", "Role"]}
          rows={[
            [<code key="g">group</code>, "Visual container. Has children."],
            [<code key="t">text</code>, "One box, one run of text."],
            [
              <code key="sh">shape</code>,
              "Formula primitive: rectangle, ellipse, polygon.",
            ],
            [
              <code key="p">path</code>,
              "Freeform vector: contours + segments.",
            ],
            [<code key="i">image</code>, "Bitmap asset in a frame."],
            [
              <code key="svg">svg</code>,
              "SVG asset. Not shape or path. Optional fill recolor.",
            ],
            [<code key="v">video</code>, "Video asset + playback."],
            [<code key="a">audio</code>, "Root-only sound. No frame."],
            [<code key="s">solid</code>, "Filled color plate. payload.color."],
            [
              <code key="ad">adjustment</code>,
              "Grade layer. Not effects.color-adjust.",
            ],
            [
              <code key="c">component</code>,
              "Sealed instance. Public props only.",
            ],
          ]}
        />
        <H2 id="not-types">Not a type</H2>
        <P>
          <code>layout</code> is packing behavior on a group, not{" "}
          <code>type: &quot;layout&quot;</code>. See{" "}
          <a className="underline" href="/docs/layers/layout">
            Layout
          </a>{" "}
          under Group.
        </P>
        <H2 id="advanced">Advanced</H2>
        <P>
          Schema also has <code>camera</code> (no frame; projection / zoom /
          parallax) and <code>bone</code> (rig length). MVP docs do not teach
          them as first-class authoring. Do not emit them unless the product
          path requires a camera or a bone rig.
        </P>
        <AiWritingGuide
          items={[
            "Pick type from this table. Do not invent caption, solid-color, or layout types.",
            "Use shape for boxes and ellipses. Use path for freeform vector. Use svg for an SVG file.",
            "Use solid for a color plate. Use adjustment for a grade layer — not effects.color-adjust.",
          ]}
        />
      </article>
    ),
  });
}
