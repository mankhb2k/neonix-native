import Link from "next/link";
import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";
import { DEPTH_DEMO } from "@/lib/docs/projects";

export function transformOverviewPage(): DocsPageView {
  return withOnThisPage({
    title: "Transform",
    previewProject: DEPTH_DEMO,
    toc: [
      { id: "atoms", title: "Atoms" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Transform"
          human="Geometry only. No size, no opacity."
          jsonPath="transform"
        />
        <P>MVP 2.5D: translate.x/y, depth, rotate.z, scale.x/y, skew.x/y, origin.x/y.</P>
        <H2 id="atoms">Atoms</H2>
        <ul className="list-disc space-y-2 pl-5 text-[15px]">
          <li>
            <Link href="/docs/transform/translate">Move</Link> —{" "}
            <code>transform.translate</code>
          </li>
          <li>
            <Link href="/docs/transform/depth">Depth</Link> —{" "}
            <code>transform.depth</code>
          </li>
          <li>
            Rotate / Scale / Skew / Origin — coming (JSON paths exist in schema).
          </li>
        </ul>
        <AiWritingGuide
          items={[
            "Never invent transform.z, transform.x, or rotation.",
            "Use transform.rotate.z for 2D rotation.",
          ]}
        />
      </article>
    ),
  });
}
