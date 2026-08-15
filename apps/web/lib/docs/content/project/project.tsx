import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { DocsTable, H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";
import { MINIMAL_EMPTY } from "@/lib/docs/projects";

export function projectPage(): DocsPageView {
  return withOnThisPage({
    title: "Project",
    toc: [
      { id: "envelope", title: "Envelope vs content" },
      { id: "root-map", title: "Root map" },
      { id: "example", title: "Minimal JSON" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Project"
          human="One JSON file is one video. This group is the container — not layers or motion."
          jsonPath="MotionProjectV1"
        />
        <P>
          Getting started answered what Motion JSON is. This section answers
          which blocks a file contains, and which blocks decide the exported
          MP4: <code>composition</code> (canvas) and <code>timeline</code>{" "}
          (clock). Picture, text, and motion live in <code>layers</code> — see{" "}
          <a className="underline" href="/docs/layer">
            Layers
          </a>
          .
        </P>
        <H2 id="envelope">Envelope vs content</H2>
        <P>
          Discriminator: <code>format: &quot;motion-project&quot;</code> and{" "}
          <code>formatVersion: 1</code>. Unknown keys are rejected (
          <code>.strict()</code>). Do not emit <code>scenes</code> or{" "}
          <code>visualTracks</code>.
        </P>
        <DocsTable
          headers={["Role", "Keys"]}
          rows={[
            [
              "Envelope (this group)",
              <code key="env">
                format, formatVersion, metadata, composition, timeline, assets
              </code>,
            ],
            [
              "Content (Layers / later)",
              <code key="content">layers[]</code>,
            ],
          ]}
        />
        <H2 id="root-map">Root map</H2>
        <DocsTable
          headers={["Need now", "Meet later"]}
          rows={[
            [
              <span key="now">
                <code>metadata</code>, <code>composition</code>,{" "}
                <code>timeline</code>, <code>layers</code>, <code>assets</code>
              </span>,
              <span key="later">
                <code>components</code>, <code>bindings</code>,{" "}
                <code>variables</code>, <code>tokens</code>,{" "}
                <code>capabilities</code>, <code>extensions</code>
              </span>,
            ],
          ]}
        />
        <P>
          Empty <code>layers</code> and <code>assets</code> are valid. Preview
          in the editor and export both read the same project file. How those
          surfaces are implemented is not part of this authoring contract.
        </P>
        <H2 id="example">Minimal JSON</H2>
        <P>
          Fixture <code>minimal-empty</code>: required envelope keys, no
          content. Point at each key — do not copy layer timing or transform
          from here.
        </P>
        <JsonBlock code={JSON.stringify(MINIMAL_EMPTY, null, 2)} />
        <AiWritingGuide
          items={[
            "Always emit a full MotionProjectV1 (format + formatVersion 1).",
            "Do not emit scenes or visualTracks.",
            "Do not write JSON for a preview engine. Write the project file.",
          ]}
        />
      </article>
    ),
  });
}
