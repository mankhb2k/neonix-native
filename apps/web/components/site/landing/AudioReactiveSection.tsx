import { Section } from "./primitives/Section";
import { SectionEyebrow } from "./primitives/SectionEyebrow";
import { SectionHeading } from "./primitives/SectionHeading";
import { Waveform } from "./primitives/Waveform";
import { Reveal } from "./primitives/Reveal";
import { WAVEFORM_SAMPLE } from "./data";

const SIGNALS = [
  { label: "Beats", color: "var(--accent)" },
  { label: "Bass energy", color: "var(--accent-magenta)" },
  { label: "Loudness", color: "var(--electric-blue)" },
  { label: "Sections", color: "var(--neon-cyan-loud)" },
] as const;

export function AudioReactiveSection() {
  return (
    <Section className="bg-[var(--landing-bg-purple)]">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <Reveal>
            <SectionEyebrow>Audio-reactive</SectionEyebrow>
            <SectionHeading className="mt-3">
              Make visuals move with the music
            </SectionHeading>
            <p className="mt-4 max-w-lg text-[1.05rem] leading-relaxed text-[var(--fg-muted)]">
              Analyze beats, bass energy, loudness, and sections to generate
              timeline keyframes automatically.
            </p>
          </Reveal>

          <Reveal delay={120}>
            <div className="mt-6 flex flex-wrap gap-2">
              {SIGNALS.map((signal) => (
                <span
                  key={signal.label}
                  className="rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em]"
                  style={{
                    color: signal.color,
                    borderColor: signal.color,
                    background: "transparent",
                  }}
                >
                  {signal.label}
                </span>
              ))}
            </div>
          </Reveal>
        </div>

        <Reveal delay={80}>
          <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--landing-bg-deep)] p-6">
            <Waveform values={WAVEFORM_SAMPLE} />
            {/* beat markers */}
            <div className="mt-3 flex justify-between">
              {WAVEFORM_SAMPLE.map((v, i) =>
                i % 8 === 0 ? (
                  <span
                    key={i}
                    className="h-2 w-0.5 bg-[var(--accent-magenta)]"
                    style={{ boxShadow: "0 0 6px var(--accent-magenta)" }}
                  />
                ) : (
                  <span key={i} className="h-2 w-0.5 bg-transparent" />
                ),
              )}
            </div>
            <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">
              waveform · beat markers · glow pulse
            </p>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
