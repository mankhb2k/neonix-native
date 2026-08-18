import { HumanName } from "@/components/docs/HumanName";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { DocsTable, H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function editorOverviewPage(): DocsPageView {
  return withOnThisPage({
    title: "Editor vs protocol",
    toc: [
      { id: "law", title: "Protocol is the law" },
      { id: "surfaces", title: "Surfaces" },
      { id: "lives-where", title: "What lives where" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Editor vs protocol"
          human="Web editor docs describe a projection. They do not change MotionProjectV1."
          jsonPath="project.layers[]"
        />
        <H2 id="law">Protocol is the law</H2>
        <P>
          Authoring JSON is defined by the protocol guides:{" "}
          <a className="underline" href="/docs/timeline">
            Timeline
          </a>
          ,{" "}
          <a className="underline" href="/docs/layers/root-zindex">
            Root layers and zIndex
          </a>
          ,{" "}
          <a className="underline" href="/docs/layer">
            What is a layer
          </a>
          . Extra keys such as <code>scenes</code> or{" "}
          <code>visualTracks</code> are rejected. The editor must read and write
          that document. Preview paint and export compile the same file.
        </P>
        <P>
          This section is <strong>web editor</strong> documentation. Desktop and
          render should keep their own surface docs. All three stay aligned to
          protocol; none of them extend the JSON schema.
        </P>
        <H2 id="surfaces">Surfaces</H2>
        <DocsTable
          headers={["Surface", "May do", "Must not"]}
          rows={[
            [
              "Protocol / AI JSON",
              "Emit layers with unique sibling zIndex and timing.",
              "Emit editor lanes, selection, or playhead.",
            ],
            [
              "Web editor (these pages)",
              "Pack several roots onto one visual lane. Drill into a group.",
              "Persist laneId, or write two roots with the same zIndex.",
            ],
            [
              "Desktop editor",
              "Same projection rules as web when it shows a timeline.",
              "A second project format.",
            ],
            [
              "Render / compile",
              "Paint the layer stack by zIndex and timing.",
              "Depend on editor packing. Overlap is resolved by zIndex.",
            ],
          ]}
        />
        <H2 id="lives-where">What lives where</H2>
        <DocsTable
          headers={["Concern", "JSON", "Editor"]}
          rows={[
            ["Root list", <code key="r">parentLayerId: null</code>, "Main view"],
            [
              "Stack order",
              <code key="z">zIndex</code>,
              "Unique per sibling. Lane packing does not share this number.",
            ],
            ["When it lives", <code key="t">timing</code>, "Strip start / length"],
            [
              "Visual track row",
              "Not a field",
              "View-only packing of non-overlapping roots",
            ],
            [
              "Audio",
              "Root-only, zIndex < 0",
              "Main view only. Never inside a group.",
            ],
            ["Playhead, zoom, selection", "Not a field", "Session only"],
          ]}
        />
      </article>
    ),
  });
}
