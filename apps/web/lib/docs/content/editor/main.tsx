import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import { EditorPackedLanesFigure } from "@/components/docs/figures/EditorPackedLanesFigure";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { DocsTable, H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function editorMainPage(): DocsPageView {
  return withOnThisPage({
    title: "Main view",
    toc: [
      { id: "main-is-root", title: "Main is root" },
      { id: "packing", title: "Packing" },
      { id: "json", title: "JSON stays protocol" },
      { id: "write-back", title: "Write-back" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Main view"
          human="The web timeline at the project root. Same list as project.layers."
          jsonPath="layers[]  parentLayerId: null"
        />
        <H2 id="main-is-root">Main is root</H2>
        <P>
          Protocol root layers are <code>parentLayerId: null</code> — see{" "}
          <a className="underline" href="/docs/layers/root-zindex">
            Root layers and zIndex
          </a>
          . In the web editor, that list <strong>is</strong> the main track
          scope. There is no extra <code>main</code> object in JSON.
        </P>
        <P>
          Audio is root-only in protocol, so it only appears here. A group at
          root is one strip, same as video, text, image, or any other visual
          type.
        </P>
        <H2 id="packing">Packing</H2>
        <P>
          Protocol treats each unique root <code>zIndex</code> as a stack slot.
          The editor may still draw several of those slots on one visual row
          when their <code>timing</code> windows do not overlap. Group and
          every other visual type may share that row. Sharing a row does not
          merge layers and does not reuse <code>zIndex</code>.
        </P>
        <EditorPackedLanesFigure />
        <DocsTable
          headers={["On main", "Allowed"]}
          rows={[
            ["video | group | text | image | … on one visual lane", "Yes, if they do not overlap in time"],
            ["Two roots with the same zIndex", "No — protocol rejects it"],
            ["Audio on main", "Yes, zIndex < 0 and unique"],
            ["Audio nested in a group", "No — protocol: audio is root-only"],
          ]}
        />
        <H2 id="json">JSON stays protocol</H2>
        <P>
          Packed lanes are not written as <code>visualTracks</code> or{" "}
          <code>laneId</code>. The document below is valid protocol: four roots,
          unique sibling <code>zIndex</code>. The figure above is only how the
          editor chooses to show them.
        </P>
        <JsonBlock
          code={JSON.stringify(
            {
              layers: [
                {
                  id: "video-a",
                  type: "video",
                  parentLayerId: null,
                  zIndex: 0,
                  timing: { start: 0, duration: 4 },
                },
                {
                  id: "hero",
                  type: "group",
                  parentLayerId: null,
                  zIndex: 1,
                  timing: { start: 4, duration: 4 },
                },
                {
                  id: "title",
                  type: "text",
                  parentLayerId: null,
                  zIndex: 2,
                  timing: { start: 1, duration: 2 },
                },
                {
                  id: "music",
                  type: "audio",
                  parentLayerId: null,
                  zIndex: -1,
                  timing: { start: 0, duration: 8 },
                },
              ],
            },
            null,
            2,
          )}
        />
        <H2 id="write-back">Write-back</H2>
        <P>
          Moving strips on main updates each layer&apos;s <code>timing</code>{" "}
          and, when stack order changes, unique <code>zIndex</code>. The editor
          must never stamp one <code>zIndex</code> onto every clip that happens
          to sit on the same visual row. Write-back walks each packed lane
          bottom to top, left to right, and assigns <code>0, 1, 2…</code>{" "}
          (audio <code>-1, -2…</code>). Render ignores packing and paints by
          protocol stack order at each time.
        </P>
      </article>
    ),
  });
}
