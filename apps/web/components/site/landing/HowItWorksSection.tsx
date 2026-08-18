import { Section } from "./primitives/Section";
import { SectionEyebrow } from "./primitives/SectionEyebrow";
import { SectionHeading } from "./primitives/SectionHeading";
import { HudPanel } from "./primitives/HudPanel";
import { Reveal } from "./primitives/Reveal";
import { FLOW_A, FLOW_B } from "./data";

function FlowRow({
  title,
  steps,
}: {
  title: string;
  steps: readonly string[];
}) {
  return (
    <div>
      <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">
        {title}
      </p>
      <ol className="mt-4 flex flex-wrap items-center gap-2">
        {steps.map((step, i) => (
          <li key={step} className="flex items-center gap-2">
            <HudPanel className="flex items-center gap-3 px-4 py-3">
              <span className="font-mono text-[11px] text-[var(--accent-text)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-[14px] font-medium text-[var(--fg-primary)]">
                {step}
              </span>
            </HudPanel>
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className="font-mono text-[var(--accent-magenta)]"
              >
                →
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function HowItWorksSection() {
  return (
    <Section className="border-y border-[var(--glass-border)]">
      <Reveal>
        <SectionEyebrow>How it works</SectionEyebrow>
        <SectionHeading className="mt-3 max-w-2xl">
          Prompt to render, or audio to neon.
        </SectionHeading>
      </Reveal>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <Reveal>
          <FlowRow title="From a prompt" steps={FLOW_A} />
        </Reveal>
        <Reveal delay={80}>
          <FlowRow title="From music" steps={FLOW_B} />
        </Reveal>
      </div>
    </Section>
  );
}
