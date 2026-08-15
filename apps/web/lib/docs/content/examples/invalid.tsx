import { HumanName } from "@/components/docs/HumanName";
import { ValidInvalid } from "@/components/docs/ValidInvalid";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { P } from "@/lib/docs/content/prose";
import {
  AUDIO_FADE,
  INVALID_MISSING_REF,
  INVALID_TRANSFORM_Z,
  MINIMAL_EMPTY,
} from "@/lib/docs/projects";

export function invalidExamplesPage(): DocsPageView {
  return {
    title: "Invalid examples",
    toc: [{ id: "valid-invalid", title: "Valid / Invalid" }],
    body: (
      <article className="pb-20">
        <HumanName title="Invalid examples" />
        <P>
          Schema and compile decide correctness. Preview is not the validator.
        </P>
        <ValidInvalid valid={MINIMAL_EMPTY} invalid={INVALID_TRANSFORM_Z} />
        <ValidInvalid valid={AUDIO_FADE} invalid={INVALID_MISSING_REF} />
      </article>
    ),
  };
}
