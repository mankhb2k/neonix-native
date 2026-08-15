import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function componentLayerPage(): DocsPageView {
  return withOnThisPage({
    title: "Component layer",
    toc: [
      { id: "instance", title: "Sealed instance" },
      { id: "outside", title: "What you may set" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Component layer"
          human="A sealed copy of a component on the project tree."
          jsonPath='layers[] type: "component"'
        />
        <H2 id="instance">Sealed instance</H2>
        <P>
          <code>type: &quot;component&quot;</code> is a sealed instance leaf.
          AI sees one layer. The compiler expands it into a wrapper plus
          internals. Wrapper atoms: <code>frame</code>,{" "}
          <code>transform</code>, <code>timing</code>, <code>zIndex</code>,{" "}
          <code>appearance</code>, <code>compositing</code>,{" "}
          <code>effects</code>, <code>semantic</code>.
        </P>
        <H2 id="outside">What you may set</H2>
        <P>
          Control the shell with wrapper atoms (fade, mask, blur the whole
          widget). Control inner public content with{" "}
          <code>payload.props</code> and optional{" "}
          <code>payload.variantId</code>. Do not edit internals,{" "}
          <code>propBindings</code>, or nested trees from the instance.
        </P>
        <JsonBlock
          code={JSON.stringify(
            {
              id: "cta",
              type: "component",
              parentLayerId: null,
              zIndex: 2,
              timing: { start: 1, duration: 4 },
              payload: {
                componentId: "call-to-action",
                variantId: "primary",
                props: { label: "Shop now" },
              },
            },
            null,
            2,
          )}
        />
        <AiWritingGuide
          items={[
            "Treat the instance as a visual wrapper: frame, transform, timing, appearance, compositing, effects.",
            "Set payload.props for inner content. Prefer that over project.bindings. Variants only override props.",
          ]}
        />
      </article>
    ),
  });
}
