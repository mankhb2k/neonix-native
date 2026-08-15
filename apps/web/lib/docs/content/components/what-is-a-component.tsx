import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function whatIsAComponentPage(): DocsPageView {
  return withOnThisPage({
    title: "What is a component",
    toc: [
      { id: "two", title: "Definition vs instance" },
      { id: "compile", title: "What compile does" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="What is a component"
          human="A sealed template. The project tree holds instances, not the inner tree."
          jsonPath="components[]"
        />
        <H2 id="two">Definition vs instance</H2>
        <P>
          The definition in <code>project.components[]</code> is the sealed
          template: internal layers, propBindings, and prop presets
          (variants). The instance is a <code>type: &quot;component&quot;</code>{" "}
          leaf on <code>project.layers</code>. To AI and users it is one
          layer. The compiler expands it into a wrapper plus internals.
        </P>
        <JsonBlock
          code={JSON.stringify(
            {
              components: [{ id: "call-to-action", version: "1.0.0" }],
              layers: [
                {
                  id: "cta",
                  type: "component",
                  parentLayerId: null,
                  zIndex: 2,
                  payload: { componentId: "call-to-action" },
                },
              ],
            },
            null,
            2,
          )}
        />
        <H2 id="compile">What compile does</H2>
        <P>
          Authoring JSON keeps the instance as a leaf. Runtime IR is the
          expanded wrapper group and the inner layers. Consumers never patch
          that inner tree from the project.
        </P>
        <AiWritingGuide
          items={[
            "Place type component on the project tree. Do not copy internal layers onto project.layers.",
            "Set wrapper atoms on the instance. Set public props for inner content.",
          ]}
        />
      </article>
    ),
  });
}
