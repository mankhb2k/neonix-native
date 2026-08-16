import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function checklistPage(): DocsPageView {
  return withOnThisPage({
    title: "AI output checklist",
    toc: [
      { id: "file", title: "File" },
      { id: "layers", title: "Layers" },
      { id: "motion", title: "Motion" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="AI output checklist"
          human="Run this against every generated project before returning it."
        />
        <H2 id="file">File</H2>
        <ul className="list-disc space-y-2 pl-5 text-[15px]">
          <li>
            <code>format</code> is <code>motion-project</code>,{" "}
            <code>formatVersion</code> is <code>1</code>.
          </li>
          <li>No extra keys. No scenes or track arrays.</li>
          <li>
            Composition has width, height, fps. 9:16 is 1080×1920, not{" "}
            <code>metadata.aspectRatio</code>.
          </li>
          <li>
            Every <code>payload.assetId</code> exists in <code>assets[]</code>.
          </li>
        </ul>
        <H2 id="layers">Layers</H2>
        <ul className="list-disc space-y-2 pl-5 text-[15px]">
          <li>Every layer has unique id, zIndex, and timing.</li>
          <li>Every visual layer has frame and transform (nested objects, not x/y/z).</li>
          <li>Audio is root-only, zIndex &lt; 0, no frame, no appearance.</li>
          <li>
            Component instances only set wrapper atoms and{" "}
            <code>payload.props</code>.
          </li>
        </ul>
        <H2 id="motion">Motion</H2>
        <ul className="list-disc space-y-2 pl-5 text-[15px]">
          <li>
            Clips use canonical paths such as{" "}
            <code>appearance.opacity</code> and{" "}
            <code>transform.translate.x</code>.
          </li>
          <li>
            Keys use <code>t</code> + <code>value</code>, local to the layer
            duration.
          </li>
          <li>
            Do not animate frame, timing, zIndex, origin, fit, trim, or
            assetId.
          </li>
        </ul>
        <P>
          If any item fails, regenerate the JSON. Do not hand-patch preview.
        </P>
        <AiWritingGuide
          items={[
            "Return one full MotionProjectV1 object.",
            "Pass this checklist before responding.",
          ]}
        />
      </article>
    ),
  });
}
