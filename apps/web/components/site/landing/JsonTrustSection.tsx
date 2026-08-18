import { Section } from "./primitives/Section";
import { SectionEyebrow } from "./primitives/SectionEyebrow";
import { SectionHeading } from "./primitives/SectionHeading";
import { JsonSpecimen } from "./primitives/JsonSpecimen";
import { Reveal } from "./primitives/Reveal";

const SPECIMEN = `{
  "format": "motion-project",
  "formatVersion": 1,
  "composition": {
    "width": 1080,
    "height": 1920,
    "fps": 30
  },
  "timeline": {
    "clips": [
      {
        "id": "clip-beat-glow",
        "property": "effects.glow.opacity",
        "keys": [
          { "t": 12.40, "value": 25 },
          { "t": 12.43, "value": 100 },
          { "t": 12.58, "value": 25 }
        ]
      }
    ]
  }
}`;

function PromptPane() {
  return (
    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--landing-bg-deep)] p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">
        Prompt
      </p>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--fg-secondary)]">
        “A neon ring that pulses with the kick drum over a dark cyber grid.”
      </p>
    </div>
  );
}

function VideoPane() {
  return (
    <div className="grid h-full place-items-center rounded-xl border border-[var(--glass-border)] bg-[var(--landing-bg-deep)] p-5">
      <div
        className="h-24 w-24 rounded-full border-2 border-[var(--accent)]"
        style={{
          boxShadow:
            "0 0 30px rgba(34,211,238,0.6), inset 0 0 30px rgba(34,211,238,0.4)",
        }}
      />
      <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">
        rendered video
      </p>
    </div>
  );
}

export function JsonTrustSection() {
  return (
    <Section className="border-y border-[var(--glass-border)]">
      <div className="mx-auto max-w-3xl text-center">
        <Reveal>
          <SectionEyebrow>Developer trust</SectionEyebrow>
          <SectionHeading className="mt-3">
            Structured motion, not prompt soup
          </SectionHeading>
          <p className="mt-4 text-[1.05rem] leading-relaxed text-[var(--fg-muted)]">
            Every video is backed by a strict, editable motion document.
          </p>
        </Reveal>
      </div>

      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        <Reveal>
          <PromptPane />
        </Reveal>
        <Reveal delay={80}>
          <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--code-block-bg)] p-5">
            <JsonSpecimen code={SPECIMEN} />
          </div>
        </Reveal>
        <Reveal delay={160}>
          <VideoPane />
        </Reveal>
      </div>
    </Section>
  );
}
