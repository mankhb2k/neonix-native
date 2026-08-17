import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import { AssetsFigure } from "@/components/docs/figures/ProjectFigures";
import { ValidInvalid } from "@/components/docs/ValidInvalid";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { DocsTable, H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";
import { AUDIO_FADE, INVALID_MISSING_REF } from "@/lib/docs/projects";

export function assetsPage(): DocsPageView {
  return withOnThisPage({
    title: "Assets",
    showToc: false,
    toc: [
      { id: "registry", title: "Registry" },
      { id: "storage", title: "uri vs managed" },
      { id: "example", title: "Example" },
      { id: "valid-invalid", title: "Valid / Invalid" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Assets"
          human="The project’s media catalog. Layers point at ids, not raw URLs."
          jsonPath="assets[]"
        />
        <H2 id="registry">Registry</H2>
        <P>
          Image, video, audio, and font layers use <code>payload.assetId</code>.
          Put the file in <code>assets[]</code> first. Payload fields per layer
          type belong in Layers.
        </P>
        <P>
          <code>assetType</code> is a union: <code>image</code>,{" "}
          <code>svg</code>, <code>video</code>, <code>audio</code>,{" "}
          <code>font</code>. <code>source.kind</code> is only{" "}
          <code>&quot;upload&quot;</code>.
        </P>
        <AssetsFigure />
        <H2 id="storage">uri vs managed</H2>
        <DocsTable
          headers={["Kind", "Rule"]}
          rows={[
            ["Unmanaged / fixture", <code key="u">uri</code>],
            [
              "Managed object storage",
              "No uri. Require integrity + sizeBytes. Upload first, then write the id.",
            ],
          ]}
        />
        <P>
          How NeonVideo stores managed bytes is product infrastructure — not
          something to invent in JSON. See storage docs later if you operate the
          product, not when you author a file.
        </P>
        <H2 id="example">Example</H2>
        <JsonBlock
          caption="One catalog entry. The audio layer only stores assetId."
          code={JSON.stringify(AUDIO_FADE.assets[0], null, 2)}
        />
        <ValidInvalid valid={AUDIO_FADE} invalid={INVALID_MISSING_REF} />
        <AiWritingGuide
          items={[
            "Do not invent googleDrive or source.kind url.",
            "Upload (or fixture uri), then reference payload.assetId.",
          ]}
        />
      </article>
    ),
  });
}
