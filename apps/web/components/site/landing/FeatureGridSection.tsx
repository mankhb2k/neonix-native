import {
  FileJson,
  Zap,
  Boxes,
  Activity,
  KeyRound,
  Database,
  Clapperboard,
  LayoutTemplate,
} from "lucide-react";
import { Section } from "./primitives/Section";
import { SectionEyebrow } from "./primitives/SectionEyebrow";
import { SectionHeading } from "./primitives/SectionHeading";
import { NeonCard } from "./primitives/NeonCard";
import { Reveal } from "./primitives/Reveal";
import { FEATURES } from "./data";

const ICONS = [
  FileJson,
  Zap,
  Boxes,
  Activity,
  KeyRound,
  Database,
  Clapperboard,
  LayoutTemplate,
] as const;

export function FeatureGridSection() {
  return (
    <Section>
      <Reveal>
        <SectionEyebrow>Features</SectionEyebrow>
        <SectionHeading className="mt-3 max-w-2xl">
          Everything a motion format should do.
        </SectionHeading>
      </Reveal>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((feature, i) => {
          const Icon = ICONS[i % ICONS.length];
          return (
            <Reveal key={feature.title} delay={i * 50}>
              <NeonCard className="h-full">
                <Icon
                  className="h-5 w-5 text-[var(--accent)]"
                  strokeWidth={1.5}
                />
                <h3 className="mt-4 text-[15px] font-semibold text-[var(--fg-primary)]">
                  {feature.title}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--fg-muted)]">
                  {feature.desc}
                </p>
              </NeonCard>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}
