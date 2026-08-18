import { Section } from "./primitives/Section";
import { SectionEyebrow } from "./primitives/SectionEyebrow";
import { SectionHeading } from "./primitives/SectionHeading";
import { NeonCard } from "./primitives/NeonCard";
import { Reveal } from "./primitives/Reveal";

const PILLARS = [
  {
    title: "AI generates structured JSON",
    desc: "A strict, editable motion document — not a black box.",
    tag: "01",
  },
  {
    title: "Components keep templates reusable",
    desc: "Swap colors, text, and media without breaking internals.",
    tag: "02",
  },
  {
    title: "Audio analysis creates beat-synced keyframes",
    desc: "Beats, bass energy, and loudness mapped to motion automatically.",
    tag: "03",
  },
] as const;

export function CorePromiseSection() {
  return (
    <Section className="border-y border-[var(--glass-border)] bg-[var(--landing-bg-deep)]">
      <div className="mx-auto max-w-3xl text-center">
        <Reveal>
          <SectionEyebrow>Core promise</SectionEyebrow>
          <SectionHeading className="mt-3">
            Describe the video. NeonVideo turns it into editable motion.
          </SectionHeading>
        </Reveal>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {PILLARS.map((pillar, i) => (
          <Reveal key={pillar.tag} delay={i * 80}>
            <NeonCard className="h-full">
              <span className="font-mono text-[11px] text-[var(--accent-text)]">
                {pillar.tag}
              </span>
              <h3 className="mt-3 text-[17px] font-semibold text-[var(--fg-primary)]">
                {pillar.title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--fg-muted)]">
                {pillar.desc}
              </p>
            </NeonCard>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
