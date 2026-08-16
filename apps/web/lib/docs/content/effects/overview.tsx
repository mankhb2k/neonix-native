import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function effectsOverviewPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Effects",
    toc: [
      { id: "meaning", title: "Meaning" },
      { id: "stack", title: "Stack" },
      { id: "animation", title: "Animation" },
      { id: "example", title: "Example" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Effects"
          human="Pixel processing on the visual layer surface."
          jsonPath="effects[]"
        />
        <H2 id="meaning">Meaning</H2>
        <P>
          Effects do not change frame, layout, transform, appearance, or
          compositing. Appearance is show/fade. Compositing is blend, mask, and
          isolation. Effects process pixels. Isolation or an offscreen pass is
          an engine concern — not a new authoring field.
        </P>
        <H2 id="stack">Stack</H2>
        <P>
          <code>effects</code> is an ordered array. Runtime preserves that
          order. Each effect needs a stable <code>id</code>, unique on the
          layer. Max 16 per layer. Types in v1: <code>blur</code>, outer{" "}
          <code>shadow</code>, outer <code>glow</code>,{" "}
          <code>color-adjust</code>. Visual layers only — not audio, not camera.
        </P>
        <H2 id="animation">Animation</H2>
        <P>
          Target <code>effects.&lt;id&gt;.field</code>, never an index. Only
          numeric leaves interpolate linearly. Do not animate a whole object. Do
          not animate effect color in v1.
        </P>
        <H2 id="example">Example</H2>
        <JsonBlock
          code={JSON.stringify(
            {
              effects: [
                { id: "fx-blur-1", type: "blur", radius: 12 },
                {
                  id: "fx-glow-1",
                  type: "glow",
                  radius: 16,
                  color: "#ffffff",
                  opacity: 80,
                },
              ],
            },
            null,
            2,
          )}
        />
        <AiWritingGuide
          items={[
            "Put pixel filters in effects[], not on transform or appearance.",
            "Give every effect a stable id. Animate effects.fx-blur-1.radius, not effects[0].",
            "Do not emit glow.intensity. Do not animate effect color.",
            "Do not put effects on audio or camera.",
          ]}
        />
      </article>
    ),
  });
}
