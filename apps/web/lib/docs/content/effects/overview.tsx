import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function effectsOverviewPage(): DocsPageView {
  return withOnThisPage({
    title: "Effects",
    toc: [
      { id: "stack", title: "Stack" },
      { id: "example", title: "Example" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName title="Effects" jsonPath="effects[]" />
        <P>
          Discriminated <code>type</code>: blur, shadow, glow, color-adjust. Max
          16 per layer. Each needs <code>id</code>.
        </P>
        <H2 id="stack">Stack</H2>
        <P>
          color-adjust percents are 0..200 (100 = normal). Glow/shadow opacity
          is 0..100 integer.
        </P>
        <H2 id="example">Example</H2>
        <JsonBlock
          code={JSON.stringify(
            {
              effects: [
                { id: "e1", type: "blur", radius: 8 },
                {
                  id: "e2",
                  type: "glow",
                  radius: 12,
                  intensity: 80,
                  opacity: 100,
                  color: "#ffffff",
                },
              ],
            },
            null,
            2,
          )}
        />
        <AiWritingGuide
          items={[
            "Use effects.glow for glow — do not invent transform.glow.",
            "Use effects.blur.radius (0..512).",
          ]}
        />
      </article>
    ),
  });
}
