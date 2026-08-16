import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import { EasingFigure } from "@/components/docs/figures/AnimationFigures";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { DocsTable, H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function easingPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Easing",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "named", title: "Named presets" },
      { id: "custom", title: "Cubic and spring" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Easing"
          human="How a keyframe interpolates to the next one."
          jsonPath="keys[].easing"
        />
        <P>
          Easing is optional on a key. Interpolation itself is decided by the
          value type: numbers tween, colors blend, and boolean / string / choice
          / asset values hold (step). There is no <code>interpolation</code>{" "}
          field.
        </P>

        <H2 id="concept">Concept</H2>
        <EasingFigure />

        <H2 id="named">Named presets</H2>
        <DocsTable
          headers={["Name", "Feel"]}
          rows={[
            [<code key="l">linear</code>, "Constant speed."],
            [<code key="ei">easeIn</code>, "Starts slow, ends fast."],
            [<code key="eo">easeOut</code>, "Starts fast, ends slow."],
            [<code key="eio">easeInOut</code>, "Slow at both ends."],
            [
              <code key="s">spring</code>,
              "Physics spring (parameterless preset).",
            ],
            [<code key="st">step</code>, "Hold the value until the next key."],
          ]}
        />

        <H2 id="custom">Cubic and spring</H2>
        <P>
          For finer control, easing may be a cubic-bezier object or a spring
          object with <code>stiffness</code> / <code>damping</code> / optional{" "}
          <code>mass</code>:
        </P>
        <JsonBlock
          caption="Authoring JSON (fragments)"
          code={JSON.stringify(
            {
              named: { t: 1, value: 100, easing: "easeOut" },
              cubic: {
                t: 1,
                value: 100,
                easing: {
                  type: "cubic-bezier",
                  x1: 0.2,
                  y1: 0.8,
                  x2: 0.4,
                  y2: 1,
                },
              },
              spring: {
                t: 1,
                value: 100,
                easing: { type: "spring", stiffness: 180, damping: 18 },
              },
            },
            null,
            2,
          )}
        />

        <AiWritingGuide
          items={[
            "Prefer the named presets: linear, easeIn, easeOut, easeInOut, spring, step.",
            "Do not emit an interpolation field — the value type decides.",
            "Use cubic-bezier or a spring object only when a preset cannot express the motion.",
          ]}
        />
      </article>
    ),
  });
}
