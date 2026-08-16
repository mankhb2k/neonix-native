import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";
import { AI_GLOBAL } from "@/lib/docs/content/getting-started/ai-rules";

export function authoringRulesPage(): DocsPageView {
  return withOnThisPage({
    title: "Authoring rules",
    toc: [
      { id: "emit", title: "What to emit" },
      { id: "never", title: "Never invent" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Authoring rules"
          human="Emit a full MotionProjectV1. Schema is the contract, not the preview canvas."
        />
        <H2 id="emit">What to emit</H2>
        <ul className="list-disc space-y-2 pl-5 text-[15px]">
          <li>
            Always a full project: <code>format: &quot;motion-project&quot;</code>,{" "}
            <code>formatVersion: 1</code>, plus composition, timeline, layers,
            assets.
          </li>
          <li>
            Root layers are lanes: <code>parentLayerId: null</code>, unique{" "}
            <code>zIndex</code>, required <code>timing</code>.
          </li>
          <li>
            Layer property animation lives in <code>timeline.clips</code>.
            Component prop animation lives in{" "}
            <code>payload.props.&lt;propId&gt;</code> keyframes.
          </li>
          <li>
            Media layers reference <code>payload.assetId</code> from{" "}
            <code>assets[]</code>. Upload first, then write the id.
          </li>
        </ul>
        <H2 id="never">Never invent</H2>
        <ul className="list-disc space-y-2 pl-5 text-[15px]">
          <li>
            <code>scenes</code>, <code>visualTracks</code>,{" "}
            <code>audioTracks</code>, <code>captionTracks</code>,{" "}
            <code>project.tracks</code>, <code>project.propertyAnimations</code>
          </li>
          <li>
            <code>transform.z</code>, <code>transform.x</code>,{" "}
            <code>transform.y</code>, <code>flipX</code>, <code>flipY</code>
          </li>
          <li>
            <code>modifiers</code>, <code>locked</code>,{" "}
            <code>metadata.aspectRatio</code>, <code>source.kind: &quot;url&quot;</code>
          </li>
        </ul>
        <P>
          Getting started has a short MCP page. This group is the checklist to
          follow before you output JSON.
        </P>
        <AiWritingGuide items={AI_GLOBAL} />
      </article>
    ),
  });
}
