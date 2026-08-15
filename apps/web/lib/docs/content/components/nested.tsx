import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function nestedPage(): DocsPageView {
  return withOnThisPage({
    title: "Nested components",
    toc: [
      { id: "childprop", title: "childProp only" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Nested components"
          human="A nested instance only receives values from its parent via childProp."
          jsonPath="components[].propBindings[].target.kind childProp"
        />
        <H2 id="childprop">childProp only</H2>
        <P>
          Project bindings do not pierce nested internals. There is no
          skip-level binding. The parent owner forwards a public prop with{" "}
          <code>childProp</code> to a direct child instance. That child fans
          out through its own propBindings.
        </P>
        <AiWritingGuide
          items={[
            "Forward nested values with childProp one level at a time.",
            "Do not point project.bindings at a layer inside a nested component.",
          ]}
        />
      </article>
    ),
  });
}
