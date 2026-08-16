import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import { ComponentVariantsFigure } from "@/components/docs/figures/ComponentVariantsFigure";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function variantsPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Variants",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "preset", title: "Props preset only" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Variants"
          human="Named public-prop presets. Not a second definition."
          jsonPath="components[].variants"
        />
        <H2 id="concept">Concept</H2>
        <ComponentVariantsFigure />
        <H2 id="preset">Props preset only</H2>
        <P>
          A variant overrides public props. It does not replace the internal
          tree, propBindings, or layout graph. Pick it with{" "}
          <code>payload.variantId</code> on the instance.
        </P>
        <JsonBlock
          code={JSON.stringify(
            {
              variants: [
                {
                  id: "primary",
                  name: "Primary CTA",
                  props: { color: "#1877f2" },
                },
              ],
            },
            null,
            2,
          )}
        />
        <AiWritingGuide
          items={[
            "Variants only contain props. Do not put layers or bindings on a variant.",
            "Select a variant with payload.variantId, then override more props if needed.",
          ]}
        />
      </article>
    ),
  });
}
