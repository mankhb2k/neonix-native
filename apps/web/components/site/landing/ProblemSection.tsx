import { Section } from "./primitives/Section";
import { SectionEyebrow } from "./primitives/SectionEyebrow";
import { SectionHeading } from "./primitives/SectionHeading";
import { HudPanel } from "./primitives/HudPanel";
import { Reveal } from "./primitives/Reveal";
import { PAINS } from "./data";

export function ProblemSection() {
  return (
    <Section>
      <Reveal>
        <SectionEyebrow>The problem</SectionEyebrow>
        <SectionHeading className="mt-3 max-w-2xl">
          Making motion graphics is still too manual.
        </SectionHeading>
      </Reveal>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PAINS.map((pain, i) => (
          <Reveal key={pain} delay={i * 60}>
            <HudPanel>
              <span className="font-mono text-[11px] text-[var(--fg-muted)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="mt-2 text-[15px] font-medium text-[var(--fg-primary)]">
                {pain}
              </p>
            </HudPanel>
          </Reveal>
        ))}
        <Reveal delay={PAINS.length * 60}>
          <HudPanel className="flex items-center justify-center border-[rgba(192,132,252,0.3)]">
            <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-[var(--accent-magenta)]">
              Sound familiar?
            </p>
          </HudPanel>
        </Reveal>
      </div>
    </Section>
  );
}
