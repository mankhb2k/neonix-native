import { ExamplesGallery } from "@/components/docs/ExamplesGallery";
import { HumanName } from "@/components/docs/HumanName";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";
import {
  AUDIO_FADE,
  DEPTH_DEMO,
  INVALID_MISSING_REF,
  INVALID_TRANSFORM_Z,
  MINIMAL_EMPTY,
  SINGLE_ROOT,
} from "@/lib/docs/projects";

export function examplesGalleryPage(): DocsPageView {
  return withOnThisPage({
    title: "Examples",
    toc: [{ id: "gallery", title: "Gallery" }],
    body: (
      <article className="pb-20">
        <HumanName
          title="Fixtures gallery"
          human="Pick a project. Valid ones preview in the editor after compile."
        />
        <div id="gallery">
          <ExamplesGallery
            items={[
              { id: "empty", label: "Minimal empty", project: MINIMAL_EMPTY, kind: "valid" },
              { id: "text", label: "Text intro", project: SINGLE_ROOT, kind: "valid" },
              { id: "depth", label: "Image parallax (solids)", project: DEPTH_DEMO, kind: "valid" },
              { id: "audio", label: "Audio with fade", project: AUDIO_FADE, kind: "valid" },
              {
                id: "bad-z",
                label: "Invalid transform.z",
                project: INVALID_TRANSFORM_Z,
                kind: "invalid",
              },
              {
                id: "bad-ref",
                label: "Invalid missing asset",
                project: INVALID_MISSING_REF,
                kind: "invalid",
              },
            ]}
          />
        </div>
      </article>
    ),
  });
}
