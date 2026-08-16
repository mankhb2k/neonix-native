import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import { ComponentBindingsFigure } from "@/components/docs/figures/ComponentVariantsFigure";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function bindingsPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Prop bindings",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "owner", title: "Owner wiring" },
      { id: "project", title: "Project bindings" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Prop bindings"
          human="Owner wires public props into internals. Project bindings only target props."
          jsonPath="project.bindings"
        />
        <H2 id="concept">Concept</H2>
        <ComponentBindingsFigure />
        <H2 id="owner">Owner wiring</H2>
        <P>
          <code>propBindings</code> live on the definition.{" "}
          <code>layerProperty</code> targets an allowed primitive sink.{" "}
          <code>childProp</code> forwards to a direct nested instance. No
          skip-level into a grandchild&apos;s internals.
        </P>
        <H2 id="project">Project bindings</H2>
        <P>
          Binding is one-way from <code>project.variables</code> to a public
          prop. The only target is <code>type: &quot;prop&quot;</code> with{" "}
          <code>layerId</code> and <code>propId</code>. Variable type must match
          the prop kind. Default AI still prefers <code>payload.props</code>.
        </P>
        <JsonBlock
          code={JSON.stringify(
            {
              id: "bind-label",
              source: { kind: "variable", variableId: "cta-text" },
              target: {
                type: "prop",
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
            "Bind only type prop. Never target a layer property path.",
            "Use payload.props unless the app needs a shared project variable.",
            "Prop kinds in v1: string, number, boolean, color, asset, choice.",
          ]}
        />
      </article>
    ),
  });
}
