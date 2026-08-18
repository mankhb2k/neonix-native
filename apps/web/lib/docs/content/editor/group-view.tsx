import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import { TimelineStrip } from "@/components/docs/TimelineStrip";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { DocsTable, H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function editorGroupViewPage(): DocsPageView {
  return withOnThisPage({
    title: "Group view",
    toc: [
      { id: "enter", title: "Double-click a group" },
      { id: "no-pack", title: "No packing" },
      { id: "timing", title: "Local timing" },
      { id: "audio", title: "No audio here" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Group view"
          human="Layer view inside a group. One sibling, one row. Protocol children, not a new document."
          jsonPath="group.children[]"
        />
        <H2 id="enter">Double-click a group</H2>
        <P>
          On{" "}
          <a className="underline" href="/docs/editor/main">
            main
          </a>
          , a root group is one strip. Double-click drills into{" "}
          <code>group.children</code> — the same tree as{" "}
          <a className="underline" href="/docs/layers/group">
            Group
          </a>
          . The editor does not flatten children onto main and does not invent
          a nested project.
        </P>
        <H2 id="no-pack">No packing</H2>
        <P>
          Inside a group, protocol <code>zIndex</code> is paint order among
          siblings that often overlap in time. The editor therefore uses{" "}
          <strong>layer view</strong>: one sibling per row. Packing several
          children onto one lane would hide that stack.
        </P>
        <DocsTable
          headers={["Scope", "Editor rows"]}
          rows={[
            ["Main (root)", "May pack non-overlapping visual roots, including groups"],
            ["Inside a group", "One child = one row. No pack."],
          ]}
        />
        <H2 id="timing">Local timing</H2>
        <P>
          Child <code>timing.start</code> is local to the group, as in{" "}
          <a className="underline" href="/docs/layers/timing">
            Layer timing
          </a>
          . Strips on this view are offset by the group&apos;s global start so
          they still sit on the project clock. Trim writes child{" "}
          <code>timing</code>, still inside the parent duration.
        </P>
        <TimelineStrip
          hideHeading
          duration={6}
          lanes={[
            { id: "card  z0", start: 0, duration: 6 },
            { id: "badge z1", start: 1, duration: 4 },
          ]}
        />
        <JsonBlock
          code={JSON.stringify(
            {
              id: "hero",
              type: "group",
              parentLayerId: null,
              zIndex: 1,
              timing: { start: 0, duration: 6 },
              children: [
                {
                  id: "card",
                  type: "solid",
                  parentLayerId: "hero",
                  zIndex: 0,
                  timing: { start: 0, duration: 6 },
                },
                {
                  id: "badge",
                  type: "text",
                  parentLayerId: "hero",
                  zIndex: 1,
                  timing: { start: 1, duration: 4 },
                },
              ],
            },
            null,
            2,
          )}
        />
        <H2 id="audio">No audio here</H2>
        <P>
          Protocol audio is root-only (
          <a className="underline" href="/docs/layers/audio">
            Audio
          </a>
          ). Group view has no audio lane. Leave the group to edit sound on
          main.
        </P>
      </article>
    ),
  });
}
