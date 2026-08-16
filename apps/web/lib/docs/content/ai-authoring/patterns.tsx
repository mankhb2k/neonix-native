import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { JsonBlock } from "@/components/docs/JsonBlock";
import { ValidInvalid } from "@/components/docs/ValidInvalid";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";
import {
  INVALID_EXTRA_KEY,
  INVALID_MISSING_REF,
  INVALID_TRANSFORM_Z,
  MINIMAL_EMPTY,
} from "@/lib/docs/projects";

export function patternsPage(): DocsPageView {
  return withOnThisPage({
    title: "Valid and invalid patterns",
    toc: [
      { id: "invented", title: "Invented fields" },
      { id: "schema", title: "Schema rejects" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Valid and invalid patterns"
          human="Copy the left column. The right column is what models invent."
        />
        <H2 id="invented">Invented fields</H2>
        <P>These fragments are never legal on MotionProjectV1:</P>
        <JsonBlock
          caption="Do not emit"
          code={`{ "transform": { "z": 100 } }
{ "transform": { "x": 10, "y": 20 } }
{ "scenes": [], "visualTracks": [] }
{ "opacity": 0.5 }
{ "flipX": true }
{ "source": { "kind": "url", "href": "https://…" } }`}
        />
        <H2 id="schema">Schema rejects</H2>
        <ValidInvalid valid={MINIMAL_EMPTY} invalid={INVALID_TRANSFORM_Z} />
        <ValidInvalid valid={MINIMAL_EMPTY} invalid={INVALID_EXTRA_KEY} />
        <ValidInvalid valid={MINIMAL_EMPTY} invalid={INVALID_MISSING_REF} />
        <AiWritingGuide
          items={[
            "If parse fails, fix JSON. Do not debug preview.",
            "Missing assetId and extra keys fail before compile.",
          ]}
        />
      </article>
    ),
  });
}
