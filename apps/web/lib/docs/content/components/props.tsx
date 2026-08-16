import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function propsPage(): DocsPageView {
  return withOnThisPage({
    title: "Component props",
    toc: [
      { id: "public", title: "Public API" },
      { id: "keyframes", title: "Prop keyframes" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName title="Component props" jsonPath="components[].props" />
        <H2 id="public">Public API</H2>
        <P>
          Definitions expose props and variants. Allowed kinds: string,
          number, boolean, color, asset, choice. Instances are{" "}
          <code>type: &quot;component&quot;</code> layers with{" "}
          <code>payload.componentId</code> and <code>payload.props</code>.
          Internals are sealed. Prop keyframes animate a public signal, not
          the instance wrapper (use appearance.opacity / transform on the
          instance for the shell).
        </P>
        <H2 id="keyframes">Prop keyframes</H2>
        <JsonBlock
          code={JSON.stringify(
            {
              kind: "keyframes",
              keys: [
                { t: 0, value: 0 },
                { t: 2, value: 100 },
              ],
            },
            null,
            2,
          )}
        />
        <AiWritingGuide
          items={[
            "Prop keyframes are public signals. Fade the whole instance with appearance.opacity on the wrapper.",
            "Do not bind into nested-in-definition layers from the project tree.",
          ]}
        />
      </article>
    ),
  });
}
