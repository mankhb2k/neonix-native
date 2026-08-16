import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { DocsTable, H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function propertyPathsPage(): DocsPageView {
  return withOnThisPage({
    title: "Canonical property paths",
    toc: [
      { id: "animate", title: "Safe to animate" },
      { id: "static", title: "Set once, do not clip" },
      { id: "clip", title: "Clip shape" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Canonical property paths"
          human="Dotted paths as they appear on the layer. Use these strings in timeline.clips[].property."
          jsonPath="timeline.clips[].property"
        />
        <H2 id="animate">Safe to animate</H2>
        <DocsTable
          headers={["Path", "Kind"]}
          rows={[
            [<code key="op">appearance.opacity</code>, "number 0..100"],
            [<code key="tx">transform.translate.x / .y</code>, "number"],
            [<code key="sx">transform.scale.x / .y</code>, "number (flip with negative)"],
            [<code key="rz">transform.rotate.z</code>, "angle"],
            [<code key="sk">transform.skew.x / .y</code>, "angle"],
            [<code key="d">transform.depth</code>, "number"],
            [<code key="fill">style.fill / style.stroke</code>, "color (shape, path)"],
            [<code key="sw">style.strokeWidth</code>, "number"],
            [<code key="fs">payload.fontSize</code>, "number (text)"],
            [<code key="pc">payload.color</code>, "color (text, solid)"],
          ]}
        />
        <H2 id="static">Set once, do not clip</H2>
        <P>
          These exist on the layer but must not appear as{" "}
          <code>timeline.clips[].property</code>:
        </P>
        <ul className="list-disc space-y-1 pl-5 text-[15px]">
          <li>
            <code>frame.width</code>, <code>frame.height</code> — scale with{" "}
            <code>transform.scale</code>
          </li>
          <li>
            <code>timing</code>, <code>zIndex</code>, <code>transform.origin</code>
          </li>
          <li>
            <code>payload.assetId</code>, <code>payload.fit</code>,{" "}
            <code>payload.crop</code>, trim fields
          </li>
          <li>
            <code>appearance.visible</code>, blend-mode, isolation, mask
          </li>
        </ul>
        <H2 id="clip">Clip shape</H2>
        <JsonBlock
          caption="Layer animation — property is a canonical path. t is local to the target layer."
          code={JSON.stringify(
            {
              id: "fade-title",
              layerId: "title",
              property: "appearance.opacity",
              keys: [
                { t: 0, value: 0 },
                { t: 0.4, value: 100 },
              ],
            },
            null,
            2,
          )}
        />
        <P>
          Component props: put keyframes on{" "}
          <code>payload.props.&lt;propId&gt;</code> with{" "}
          <code>keys[].value</code>. Do not target internals from{" "}
          <code>timeline.clips</code>.
        </P>
        <AiWritingGuide
          items={[
            "Use transform.translate.x, never transform.x or transform.z.",
            "Use appearance.opacity, never opacity at the layer root.",
            "Do not animate frame, timing, zIndex, fit, trim, assetId, or origin.",
          ]}
        />
      </article>
    ),
  });
}
