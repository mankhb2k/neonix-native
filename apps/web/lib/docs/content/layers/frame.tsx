import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import { FrameFigure } from "@/components/docs/figures/FrameFigure";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { DocsTable, H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function framePage(): DocsPageView {
  return withOnThisPage({ showToc: false,
    title: "Frame",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "rules", title: "Required vs forbidden" },
      { id: "example", title: "Example" },
      { id: "not", title: "What it is not" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Frame"
          human="The local size box of this layer, before transform."
          jsonPath="layers[].frame"
        />
        <P>
          <code>frame.width</code> and <code>frame.height</code> are how big
          this layer is in its own local space — measured before translate,
          scale, or rotate apply.
        </P>

        <H2 id="concept">Concept</H2>
        <FrameFigure />

        <H2 id="rules">Required vs forbidden</H2>
        <DocsTable
          headers={["Required on", "Forbidden on"]}
          rows={[
            [
              "group, component, text, image, svg, video, shape, path, solid, bone, adjustment",
              "audio, camera",
            ],
          ]}
        />
        <P>
          Canonical JSON never derives <code>group.frame</code> from children —
          the editor may auto-fit while authoring, but the written file must
          carry concrete numbers. Layout always computes from the group&apos;s{" "}
          <code>frame</code>; <code>layoutItem</code> changes a child&apos;s
          resulting frame at compile time.
        </P>

        <H2 id="example">Example</H2>
        <JsonBlock
          caption="Authoring JSON (fragment)"
          code={JSON.stringify({ frame: { width: 800, height: 120 } }, null, 2)}
        />

        <H2 id="not">What it is not</H2>
        <P>
          Not a timeline unit. Not a container. Not a default clipping box. Not
          a transform. Not control over children.
        </P>

        <AiWritingGuide
          items={[
            "If the layer is visual (including group), always set frame.",
            "Group frame is required and does not clip children. Never derive it from children in canonical JSON.",
            "Audio and camera must not have frame.",
            "Do not put size on transform.width/height — transform has no size fields.",
          ]}
        />
      </article>
    ),
  });
}
