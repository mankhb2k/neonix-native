import { HumanName } from "@/components/docs/HumanName";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";
import { SINGLE_ROOT } from "@/lib/docs/projects";

export function pixiPreviewPage(): DocsPageView {
  return withOnThisPage({
    title: "Preview vs export",
    previewProject: SINGLE_ROOT,
    toc: [
      { id: "use", title: "How to use" },
      { id: "contract", title: "Contract" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Preview vs export"
          human="The editor shows an approximate view. Export is the MP4."
        />
        <H2 id="use">How to use</H2>
        <P>
          Open a valid project in the editor to preview. Play, scrub, and
          inspect layers there. Download or render when you need the file that
          ships. You do not configure a renderer in JSON.
        </P>
        <H2 id="contract">Contract</H2>
        <ul className="list-disc space-y-2 pl-5 text-[15px]">
          <li>Correctness is schema + references + compile, not the canvas.</li>
          <li>If JSON fails parse, fix the file. Preview will not run.</li>
          <li>Export is the final output. Preview may simplify effects.</li>
        </ul>
      </article>
    ),
  });
}
