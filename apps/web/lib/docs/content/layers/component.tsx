import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { ExampleResultFrame } from "@/components/docs/figures/ExampleResultFrame";
import { ExampleWithResult } from "@/components/docs/figures/ExampleWithResult";
import { ComponentFigure } from "@/components/docs/figures/ComponentFigure";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { visualLayerExample } from "@/lib/docs/content/layers/example-json";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function componentLayerPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Component layer",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "instance", title: "Sealed instance" },
      { id: "example", title: "Example layer" },
      { id: "not-v1", title: "Not in V1" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Component layer"
          human="A sealed copy of a component on the project tree."
          jsonPath='layers[] type: "component"'
        />
        <P>
          <code>type: &quot;component&quot;</code> is a sealed instance leaf. AI
          sees one layer. The compiler expands it into a wrapper plus internals.
          Wrapper atoms: <code>frame</code>, <code>transform</code>,{" "}
          <code>timing</code>, <code>zIndex</code>, <code>appearance</code>,{" "}
          <code>compositing</code>, <code>effects</code>, <code>semantic</code>.
        </P>

        <H2 id="concept">Concept</H2>
        <ComponentFigure />

        <H2 id="instance">Sealed instance</H2>
        <P>
          Control the shell with wrapper atoms (fade, mask, blur the whole
          widget). Control inner public content with <code>payload.props</code>{" "}
          and optional <code>payload.variantId</code>. Do not edit internals,{" "}
          <code>propBindings</code>, or nested trees from the instance.
        </P>

        <H2 id="example">Example layer</H2>
        <ExampleWithResult
          json={JSON.stringify(
            visualLayerExample({
              id: "cta",
              type: "component",
              frame: { width: 280, height: 64 },
              payload: {
                componentId: "call-to-action",
                variantId: "primary",
                props: { label: "Shop now" },
              },
            }),
            null,
            2,
          )}
          result={
            <ExampleResultFrame
              label="Rendered component instance"
              caption="frame 280×64 · variant primary · props.label"
              viewBox="0 0 400 140"
            >
              <rect
                x={70}
                y={28}
                width={260}
                height={56}
                rx={8}
                fill="#0d9488"
                stroke="#94a3b8"
                strokeDasharray="5 4"
              />
              <text
                x={200}
                y={62}
                textAnchor="middle"
                fontSize={16}
                fill="#fff"
                fontFamily="sans-serif"
              >
                Shop now
              </text>
            </ExampleResultFrame>
          }
        />

        <H2 id="not-v1">Not in V1</H2>
        <P>
          No editing internals from the instance. No <code>propBindings</code>{" "}
          on the layer. Variants only override public props.
        </P>

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
