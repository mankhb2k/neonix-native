import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import { KeyframesFigure } from "@/components/docs/figures/AnimationFigures";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function keyframesPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Motion",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "authoring", title: "Authoring" },
      { id: "compiled", title: "Compiled propertyAnimations" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Motion"
          human="Timing on layers vs compiled propertyAnimations."
        />
        <H2 id="concept">Concept</H2>
        <KeyframesFigure />
        <H2 id="authoring">Authoring</H2>
        <P>
          <code>layer.timing</code> places a layer on the clock. Component props
          may use <code>{`{ kind: "keyframes", keys: [{ t, value }] }`}</code> —
          field is <code>value</code>, not <code>v</code>.
        </P>
        <H2 id="compiled">Compiled propertyAnimations</H2>
        <P>
          Compiled property animations look like{" "}
          <code>{`{ layerId, property, valueKind, keys: [{ t, v }] }`}</code>.
          That shape is compiler output. It is not authoring{" "}
          <code>timeline.clips</code>. Runtime stores them on{" "}
          <code>project.propertyAnimations</code>.
        </P>
        <JsonBlock
          caption="Compiled propertyAnimation — do not paste into authoring JSON"
          code={JSON.stringify(
            {
              layerId: "title",
              property: "appearance.opacity",
              valueKind: "number",
              keys: [
                { t: 0, v: 0 },
                { t: 0.4, v: 100 },
              ],
            },
            null,
            2,
          )}
        />
        <AiWritingGuide
          items={[
            "Do not add project.propertyAnimations or project.tracks in authoring JSON.",
            "Use layer.timing for when a layer exists.",
            "Use component prop keyframes with keys[].value.",
          ]}
        />
      </article>
    ),
  });
}
