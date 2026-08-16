import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import { MaskFigure } from "@/components/docs/figures/CompositingFigures";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function maskPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Mask",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "why", title: "Why mask exists" },
      { id: "shape", title: "Shape" },
      { id: "ai", title: "AI defaults" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Mask"
          human="Explicit clip or reveal. Not group.frame."
          jsonPath="compositing.mask"
        />
        <H2 id="concept">Concept</H2>
        <MaskFigure />
        <H2 id="why">Why mask exists</H2>
        <P>
          A group does not clip to its frame. Use <code>compositing.mask</code>{" "}
          to cut or reveal. The source layer must exist, must not be the masked
          layer itself, and must be <code>path</code>, <code>shape</code>,{" "}
          <code>solid</code>, <code>group</code>, or <code>component</code>.
        </P>
        <H2 id="shape">Shape</H2>
        <P>
          Required: <code>sourceLayerId</code>, <code>mode</code>,{" "}
          <code>source-visibility</code>. Schema modes: <code>clip</code>,{" "}
          <code>alpha</code>, <code>inverse-alpha</code>, <code>luma</code>,{" "}
          <code>inverse-luma</code>. Visibility: <code>mask-only</code> or{" "}
          <code>content-and-mask</code>.
        </P>
        <H2 id="ai">AI defaults</H2>
        <P>
          Prefer <code>clip</code> or <code>alpha</code> with{" "}
          <code>mask-only</code>. Keep <code>inverse-alpha</code>,{" "}
          <code>luma</code>, <code>inverse-luma</code>, and{" "}
          <code>content-and-mask</code> in schema, but treat them as advanced.
        </P>
        <JsonBlock
          code={JSON.stringify(
            {
              compositing: {
                mask: {
                  sourceLayerId: "cutout",
                  mode: "alpha",
                  "source-visibility": "mask-only",
                },
              },
            },
            null,
            2,
          )}
        />
        <AiWritingGuide
          items={[
            "Cut with compositing.mask, never with group.frame.",
            "Default mask mode is clip or alpha. Default source-visibility is mask-only.",
            "Mask source must be path, shape, solid, group, or component.",
          ]}
        />
      </article>
    ),
  });
}
