import { GlowButton } from "./primitives/GlowButton";
import { BeatPulsePreview } from "./primitives/BeatPulsePreview";
import { GridBackdrop } from "./primitives/GridBackdrop";
import { ScanlineOverlay } from "./primitives/ScanlineOverlay";
import { SectionEyebrow } from "./primitives/SectionEyebrow";
import { appUrl } from "@/lib/hosts";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 45% at 20% -5%, rgba(34,211,238,0.16) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 90% 10%, rgba(192,132,252,0.14) 0%, transparent 50%)",
        }}
      />
      <GridBackdrop />
      <ScanlineOverlay />

      <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-6 py-20 sm:py-28 lg:grid-cols-2 lg:items-center">
        <div>
          <SectionEyebrow>Neon cyberpunk video generator</SectionEyebrow>
          <h1
            style={{ fontFamily: "var(--font-display)" }}
            className="mt-4 text-[clamp(2.5rem,6vw,4.25rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-[var(--fg-primary)]"
          >
            Create Neon Motion Videos from JSON, Audio, and AI
          </h1>
          <p className="mt-5 max-w-xl text-[1.05rem] leading-relaxed text-[var(--fg-muted)]">
            Build cyberpunk music visualizers, story videos, glowing titles, and
            animated templates with an AI-first motion format.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <GlowButton href={appUrl("/")}>Start Creating</GlowButton>
            <GlowButton href="#showcase" variant="secondary">
              Watch Demo
            </GlowButton>
          </div>
        </div>

        <BeatPulsePreview />
      </div>
    </section>
  );
}
