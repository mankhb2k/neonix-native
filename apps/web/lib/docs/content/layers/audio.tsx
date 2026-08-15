import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

export function audioLayerPage(): DocsPageView {
  return withOnThisPage({
    title: "Audio",
    toc: [
      { id: "exception", title: "Not a visual layer" },
      { id: "root", title: "Root-only lane" },
      { id: "payload", title: "Playback payload" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Audio"
          human="A root-only timeline sound object. Not a visual primitive."
          jsonPath='layers[] type: "audio"'
        />
        <H2 id="exception">Not a visual layer</H2>
        <P>
          Audio still lives on <code>project.layers</code> and uses{" "}
          <code>timing</code>. It does not use the visual model: no{" "}
          <code>frame</code>, no <code>transform</code>, no layout, no{" "}
          <code>appearance</code>. Mute and volume are payload fields, not
          visibility.
        </P>
        <H2 id="root">Root-only lane</H2>
        <P>
          <code>parentLayerId</code> is always <code>null</code>.{" "}
          <code>zIndex</code> is required and negative. That number is a
          timeline lane rule, not visual stacking.
        </P>
        <JsonBlock
          code={JSON.stringify(
            {
              id: "music",
              type: "audio",
              parentLayerId: null,
              zIndex: -1,
              timing: { start: 0, duration: 8 },
              payload: {
                assetId: "bgm",
                trimStart: 0,
                volume: 80,
                fadeIn: 0.5,
                fadeOut: 1,
                loop: false,
                muted: false,
              },
            },
            null,
            2,
          )}
        />
        <H2 id="payload">Playback payload</H2>
        <P>
          Native fields: <code>assetId</code>, <code>trimStart</code>,{" "}
          <code>trimEnd</code>, <code>playbackRate</code>, <code>volume</code>{" "}
          (0..100), <code>fadeIn</code>, <code>fadeOut</code>,{" "}
          <code>loop</code>, <code>muted</code>. <code>trim*</code> cuts the
          source, not layer timing.
        </P>
        <AiWritingGuide
          items={[
            "Keep audio at the root with zIndex < 0.",
            "Do not nest audio in a group.",
            "Do not emit frame, transform, appearance, or layout on audio.",
            "Mute with payload.muted. Volume with payload.volume.",
          ]}
        />
      </article>
    ),
  });
}
