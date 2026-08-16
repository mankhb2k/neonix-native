import type { ReactNode } from "react";
import { HumanName } from "@/components/docs/HumanName";
import { QuickReference } from "@/components/docs/QuickReference";
import { JsonBlock } from "@/components/docs/JsonBlock";
import { TimelineStrip, lanesFromProject } from "@/components/docs/TimelineStrip";
import { ValidInvalid } from "@/components/docs/ValidInvalid";
import { AiWritingGuide } from "@/components/docs/AiWritingGuide";
import type { QuickRef } from "@/lib/docs/atoms";

export function AtomPage({
  title,
  human,
  jsonPath,
  lede,
  visual,
  quick,
  meaning,
  authoringExample,
  authoringCaption,
  projectForTimeline,
  compiledTrack,
  valid,
  invalid,
  mistakes,
  ai,
}: {
  title: string;
  human: string;
  jsonPath: string;
  lede: string;
  visual?: ReactNode;
  quick: QuickRef;
  meaning: string[];
  authoringExample: unknown;
  authoringCaption?: string;
  projectForTimeline?: { layers?: unknown[]; timeline?: { duration?: number } };
  compiledTrack?: unknown;
  valid: unknown;
  invalid: unknown;
  mistakes: string[];
  ai: string[];
}) {
  const strip = projectForTimeline
    ? lanesFromProject(projectForTimeline)
    : null;
  return (
    <article className="pb-20">
      <HumanName title={title} human={human} jsonPath={jsonPath} />
      <p className="text-[15px] leading-7 text-[var(--fg-primary)]">{lede}</p>
      {visual}
      <QuickReference {...quick} />
      <section id="meaning" className="my-8">
        <h2 className="mb-3 text-xl font-semibold tracking-tight">Meaning</h2>
        <ul className="list-disc space-y-1 pl-5 text-[15px]">
          {meaning.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
      <section id="example" className="my-8">
        <h2 className="mb-3 text-xl font-semibold tracking-tight">Example</h2>
        <JsonBlock
          caption={authoringCaption ?? "Authoring JSON (fragment or project)"}
          code={JSON.stringify(authoringExample, null, 2)}
        />
      </section>
      {strip ? <TimelineStrip lanes={strip.lanes} duration={strip.duration} /> : null}
      {compiledTrack ? (
        <section id="keyframes" className="my-8">
          <h2 className="mb-3 text-xl font-semibold tracking-tight">
            With Keyframes
          </h2>
          <p className="mb-2 text-[13px] text-[var(--fg-muted)]">
            Compiled motion — not a field on MotionProjectV1. Do not paste this
            into <code>project.layers</code>.
          </p>
          <JsonBlock code={JSON.stringify(compiledTrack, null, 2)} />
        </section>
      ) : null}
      <ValidInvalid valid={valid} invalid={invalid} />
      <section id="mistakes" className="my-8">
        <h2 className="mb-3 text-xl font-semibold tracking-tight">
          Common mistakes
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-[15px]">
          {mistakes.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
      <AiWritingGuide items={ai} />
    </article>
  );
}
