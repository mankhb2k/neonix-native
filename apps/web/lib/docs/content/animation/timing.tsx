import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function animationTimingPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Timing",
    toc: [
      { id: "layer", title: "Layer window" },
      { id: "keys", title: "Property keyframes" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Timing"
          human="Layer timing is the on/off window. Keyframes animate properties inside that window."
        />
        <H2 id="layer">Layer window</H2>
        <P>
          <code>layer.timing</code> is required on every layer. It is not an
          animation track. See{" "}
          <a className="underline" href="/docs/layers/timing">
            Layer timing
          </a>
          .
        </P>
        <H2 id="keys">Property keyframes</H2>
        <P>
          Keyframe <code>t</code> is local to the layer (or component instance)
          window: <code>0 .. layer.timing.duration</code>. It does not replace{" "}
          <code>timing.start</code>.
        </P>
        <JsonBlock
          code={JSON.stringify(
            {
              timing: { start: 2, duration: 4 },
              note: "A keyframe at t=1 fires at global time 3.",
            },
            null,
            2,
          )}
        />
        <AiWritingGuide
          items={[
            "Set layer.timing first. Then put keyframes in 0..duration of that layer.",
            "Do not use keyframes as a substitute for the layer in/out window.",
          ]}
        />
      </article>
    ),
  });
}
