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
          <code>type: &quot;component&quot;</code> is a real layer: it has its
          own <code>timing</code>, <code>zIndex</code>, <code>transform</code>,
          and <code>frame</code>. Internals stay inside{" "}
          <code>project.components[]</code>. Consumers do not edit those inner
          layers.
        </P>
        <H2 id="outside">What you may set</H2>
        <P>
          Outside the seal: position, scale, rotation, timing,{" "}
          <code>payload.variantId</code>, and <code>payload.props</code> that
          the owner exposed. Every other customization goes through those
          public props — never through an inner <code>layerId</code>.
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
            "Treat a component layer like a group wrapper: move, time, and scale it.",
            "Set only public props and variantId. Do not author internal layers from the instance.",
          ]}
        />
      </article>
    ),
  });
}
