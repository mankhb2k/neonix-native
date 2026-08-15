import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function glowPage(): DocsPageView {
  return withOnThisPage({
    title: "Glow",
    toc: [
      { id: "meaning", title: "Meaning" },
      { id: "example", title: "Example" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Glow"
          human="Even outer halo around the layer silhouette."
          jsonPath="effects[].type = glow"
        />
        <H2 id="meaning">Meaning</H2>
        <P>
          v1 glow is outer only. Inner glow would be a later effect type, not
          a flag. Strength is <code>opacity</code> (0..100) — do not emit{" "}
          <code>intensity</code>. Animate <code>radius</code> and{" "}
          <code>opacity</code> linearly. Do not animate <code>color</code>.
        </P>
        <H2 id="example">Example</H2>
        <JsonBlock
          code={JSON.stringify(
            {
              id: "fx-glow-1",
              type: "glow",
              radius: 16,
              color: "#ffffff",
              opacity: 80,
            },
            null,
            2,
          )}
        />
        <AiWritingGuide
          items={[
            "Use type glow with radius, color, and opacity.",
            "Do not emit intensity. Opacity is the visible strength.",
            "Animate effects.fx-glow-1.radius and effects.fx-glow-1.opacity.",
          ]}
        />
      </article>
    ),
  });
}
