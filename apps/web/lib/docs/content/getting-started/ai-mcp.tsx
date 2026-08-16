import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { AI_GLOBAL } from "./ai-rules";

export function aiMcpPage(): DocsPageView {
  return {
    title: "How AI/MCP should write JSON",
    toc: [
      { id: "rules", title: "Rules" },
      { id: "never", title: "Never invent" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="How AI/MCP should write JSON"
          human="Short rules. The AI authoring group is the full checklist."
        />
        <P>
          Full list:{" "}
          <a className="underline" href="/docs/ai/rules">
            Authoring rules
          </a>
          ,{" "}
          <a className="underline" href="/docs/ai/property-paths">
            canonical property paths
          </a>
          ,{" "}
          <a className="underline" href="/docs/ai/checklist">
            output checklist
          </a>
          .
        </P>
        <H2 id="rules">Rules</H2>
        <ul className="list-disc space-y-2 pl-5 text-[15px]">
          <li>Emit a full MotionProjectV1, not a scene graph or partial clip.</li>
          <li>
            Root layers need <code>parentLayerId: null</code> and unique{" "}
            <code>zIndex</code> (visual ≥ 0, audio &lt; 0). Nested layers also
            need unique sibling <code>zIndex &gt;= 0</code> and{" "}
            <code>timing</code>.
          </li>
          <li>
            Opacity is <code>appearance.opacity</code> integer 0..100 on visual
            layers only. Audio has no appearance.
          </li>
          <li>
            Component consumers set public props only. Do not author internal
            component layers from the outside.
          </li>
        </ul>
        <H2 id="never">Never invent</H2>
        <JsonBlock
          code={`// invalid
{ "transform": { "z": 100 } }
{ "transform": { "x": 10, "y": 20 } }
{ "scenes": [], "visualTracks": [] }`}
        />
        <AiWritingGuide items={AI_GLOBAL} />
      </article>
    ),
  };
}
