import { Music2, Clapperboard, Type, Wand2, Mic, Sparkles } from "lucide-react";
import { Section } from "./primitives/Section";
import { SectionEyebrow } from "./primitives/SectionEyebrow";
import { SectionHeading } from "./primitives/SectionHeading";
import { NeonCard } from "./primitives/NeonCard";
import { Reveal } from "./primitives/Reveal";
import { USE_CASES } from "./data";

const ICONS = [Music2, Clapperboard, Type, Wand2, Mic, Sparkles] as const;

export function UseCasesSection() {
  return (
    <Section>
      <Reveal>
        <SectionEyebrow>Use cases</SectionEyebrow>
        <SectionHeading className="mt-3 max-w-2xl">
          From beats to brand — one motion format.
        </SectionHeading>
      </Reveal>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {USE_CASES.map((useCase, i) => {
          const Icon = ICONS[i % ICONS.length];
          return (
            <Reveal key={useCase.title} delay={i * 60}>
              <NeonCard className="h-full">
                <Icon
                  className="h-5 w-5 text-[var(--accent)]"
                  strokeWidth={1.5}
                />
                <h3 className="mt-4 text-[16px] font-semibold text-[var(--fg-primary)]">
                  {useCase.title}
                </h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--fg-muted)]">
                  {useCase.desc}
                </p>
              </NeonCard>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}
