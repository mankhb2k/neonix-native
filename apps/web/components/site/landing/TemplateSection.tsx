import { Section } from "./primitives/Section";
import { SectionEyebrow } from "./primitives/SectionEyebrow";
import { SectionHeading } from "./primitives/SectionHeading";
import { NeonCard } from "./primitives/NeonCard";
import { Reveal } from "./primitives/Reveal";
import { TEMPLATES } from "./data";

export function TemplateSection() {
  return (
    <Section className="border-y border-[var(--glass-border)]">
      <div className="mx-auto max-w-3xl text-center">
        <Reveal>
          <SectionEyebrow>Templates &amp; components</SectionEyebrow>
          <SectionHeading className="mt-3">
            Templates that AI can actually control
          </SectionHeading>
          <p className="mt-4 text-[1.05rem] leading-relaxed text-[var(--fg-muted)]">
            Change colors, text, images, and motion without breaking internals.
          </p>
        </Reveal>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TEMPLATES.map((template, i) => (
          <Reveal key={template.name} delay={i * 70}>
            <NeonCard className="h-full">
              <h3 className="text-[16px] font-semibold text-[var(--fg-primary)]">
                {template.name}
              </h3>
              <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--accent-magenta)]">
                {template.props}
              </p>
            </NeonCard>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
