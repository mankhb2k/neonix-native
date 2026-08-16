import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import { HumanName } from "@/components/docs/HumanName";
import { ValidInvalid } from "@/components/docs/ValidInvalid";
import { ValidationFigure } from "@/components/docs/figures/ProjectFigures";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { DocsTable, H2, P } from "@/lib/docs/content/prose";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";
import {
  INVALID_DUPLICATE_ID,
  INVALID_EXTRA_KEY,
  INVALID_FORMAT_VERSION,
  INVALID_MISSING_REF,
  MINIMAL_EMPTY,
} from "@/lib/docs/projects";

export function validationPage(): DocsPageView {
  return withOnThisPage({
    title: "Validation basics",
    showToc: false,
    toc: [
      { id: "order", title: "Order" },
      { id: "project-errors", title: "Project-level errors" },
      { id: "valid-invalid", title: "Valid / Invalid" },
      { id: "ai-guide", title: "AI writing guide" },
    ],
    body: (
      <article className="pb-20">
        <HumanName
          title="Validation basics"
          human="Wrong JSON stops before compile. Preview is not the checker."
        />
        <H2 id="order">Order</H2>
        <P>This page is the sequence, not every error code.</P>
        <ol className="my-4 list-decimal space-y-2 pl-5 text-[15px]">
          <li>Normalize text payload</li>
          <li>
            Schema (<code>MotionProjectV1Schema</code>, <code>.strict()</code>)
          </li>
          <li>Reference ids (assets, variables, components)</li>
          <li>Compiler diagnostics</li>
        </ol>
        <P>
          Preview and export only run after a project parses. A broken preview
          does not mean the JSON is invalid. Invalid JSON never reaches compile.
        </P>
        <ValidationFigure />
        <H2 id="project-errors">Project-level errors</H2>
        <DocsTable
          headers={["Symptom", "Why"]}
          rows={[
            [
              <code key="fv">formatVersion ≠ 1</code>,
              "Only version 1 is accepted.",
            ],
            ["Extra key", "Strict object — no scenes, no unknown fields."],
            [
              "Duplicate id",
              "Layer / asset / variable / binding ids must be unique.",
            ],
            [
              "Missing asset or variable ref",
              "Id used on a layer but not in the registry.",
            ],
            [
              "Root missing zIndex or timing",
              "Noted here; rules live in Layers.",
            ],
          ]}
        />
        <ValidInvalid valid={MINIMAL_EMPTY} invalid={INVALID_FORMAT_VERSION} />
        <ValidInvalid valid={MINIMAL_EMPTY} invalid={INVALID_EXTRA_KEY} />
        <ValidInvalid valid={MINIMAL_EMPTY} invalid={INVALID_DUPLICATE_ID} />
        <ValidInvalid valid={MINIMAL_EMPTY} invalid={INVALID_MISSING_REF} />
        <AiWritingGuide
          items={[
            "If parse fails, fix the JSON. Do not debug preview.",
            "Duplicate ids and missing assetId fail before compile.",
          ]}
        />
      </article>
    ),
  });
}
