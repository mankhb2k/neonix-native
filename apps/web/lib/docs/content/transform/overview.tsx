import Link from "next/link";
import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { TransformPipelineFigure } from "@/components/docs/figures/TransformPipelineFigure";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function transformOverviewPage(): DocsPageView {
  return withOnThisPage({
    showToc: false,
    title: "Transform",
    toc: [
      { id: "concept", title: "Concept" },
      { id: "atoms", title: "Atoms" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Transform"
          human="How the local frame is placed, rotated, scaled, skewed, and set in depth."
          jsonPath="transform"
        />
        <P>
          Same object on every visual layer. Not layout, not timing, not paint
          order. Audio has no transform.
        </P>
        <H2 id="concept">Concept</H2>
        <TransformPipelineFigure />
        <H2 id="atoms">Atoms</H2>
        <ul className="list-disc space-y-2 pl-5 text-[15px]">
          <li>
            <Link href="/docs/transform/translate">Translate</Link>
          </li>
          <li>
            <Link href="/docs/transform/scale">Scale</Link>
          </li>
          <li>
            <Link href="/docs/transform/rotate">Rotate</Link>
          </li>
          <li>
            <Link href="/docs/transform/skew">Skew</Link>
          </li>
          <li>
            <Link href="/docs/transform/origin">Origin</Link>
          </li>
          <li>
            <Link href="/docs/transform/depth">Depth</Link>
          </li>
        </ul>
        <AiWritingGuide
          items={[
            "Write transform.translate, scale, rotate.z, skew, origin, depth.",
            "Flip with negative scale. Prefer origin 0, 0.5, or 1.",
            "Never invent transform.z, flipX, flipY, matrix, or rotate.x/y.",
            "Use zIndex for stacking, depth for space.",
          ]}
        />
      </article>
    ),
  });
}
