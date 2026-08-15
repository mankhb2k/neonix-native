import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function bindingsPage(): DocsPageView {
  return withOnThisPage({
    title: "Prop bindings",
    toc: [
      { id: "owner", title: "Owner wiring" },
      { id: "project", title: "Project bindings" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Prop bindings"
          human="Owner wires public props into internals. Project bindings to props are advanced."
          jsonPath="components[].propBindings"
        />
        <H2 id="owner">Owner wiring</H2>
        <P>
          <code>propBindings</code> live on the definition.{" "}
          <code>layerProperty</code> targets an internal layer.{" "}
          <code>childProp</code> forwards to a direct nested instance. No
          skip-level into a grandchild&apos;s internals.
        </P>
        <H2 id="project">Project bindings</H2>
        <P>
          Default AI sets <code>payload.props</code>.{" "}
          <code>project.bindings</code> with{" "}
          <code>target.type: &quot;componentLayer&quot;</code> and{" "}
          <code>propId</code> stays in the protocol for apps. It does not
          reach nested internals; those only receive <code>childProp</code>.
        </P>
        <JsonBlock
          code={JSON.stringify(
            {
              id: "bind-label",
              source: { kind: "variable", variableId: "cta-text" },
              target: {
                type: "componentLayer",
                layerId: "cta",
                propId: "label",
              },
            },
            null,
            2,
          )}
        />
        <AiWritingGuide
          items={[
            "Prefer payload.props. Use project.bindings to a propId only when the app needs a shared variable.",
            "Never bind a project target to an internal layer id inside a component.",
          ]}
        />
      </article>
    ),
  });
}
