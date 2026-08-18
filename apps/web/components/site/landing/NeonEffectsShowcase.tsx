import { Section } from "./primitives/Section";
import { SectionEyebrow } from "./primitives/SectionEyebrow";
import { SectionHeading } from "./primitives/SectionHeading";
import { Reveal } from "./primitives/Reveal";
import { EFFECTS } from "./data";

/** Render a demo tile for each neon primitive effect. */
function EffectTile({ name, swatch }: { name: string; swatch: string }) {
  return (
    <div className="group relative grid h-44 place-items-center overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--landing-bg-deep)] transition duration-200 hover:border-[var(--neon-cyan-loud)]">
      {/* demo shape */}
      <div
        className="h-20 w-20 rounded-xl border"
        style={{
          borderColor: swatch,
          background: `linear-gradient(135deg, ${swatch} 0%, transparent 70%)`,
          boxShadow: `0 0 30px ${swatch}, inset 0 0 18px ${swatch}`,
        }}
      />
      <span className="absolute bottom-3 left-3 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--fg-muted)] group-hover:text-[var(--fg-primary)]">
        {name}
      </span>
    </div>
  );
}

export function NeonEffectsShowcase() {
  return (
    <Section
      id="showcase"
      className="border-y border-[var(--glass-border)] bg-[var(--landing-bg-deep)]"
    >
      <div className="mx-auto max-w-3xl text-center">
        <Reveal>
          <SectionEyebrow>Neon effects</SectionEyebrow>
          <SectionHeading className="mt-3">
            Built for light, glow, rhythm, and atmosphere.
          </SectionHeading>
        </Reveal>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EFFECTS.map((effect, i) => (
          <Reveal key={effect.name} delay={i * 60}>
            <EffectTile name={effect.name} swatch={effect.swatch} />
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
