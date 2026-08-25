import { GlowButton } from "./primitives/GlowButton";
import { GridBackdrop } from "./primitives/GridBackdrop";
import { Reveal } from "./primitives/Reveal";
import { ScanlineOverlay } from "./primitives/ScanlineOverlay";

export function FinalCtaSection() {
  return (
    <section className="relative overflow-hidden border-t border-[var(--glass-border)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 50% at 50% 110%, rgba(192,132,252,0.16) 0%, transparent 55%), radial-gradient(ellipse 50% 45% at 50% -5%, rgba(34,211,238,0.14) 0%, transparent 50%)",
        }}
      />
      <GridBackdrop />
      <ScanlineOverlay />

      <div className="relative mx-auto w-full max-w-3xl px-6 py-24 text-center sm:py-32">
        <Reveal>
          <h2
            style={{ fontFamily: "var(--font-display)" }}
            className="text-[clamp(2.25rem,5vw,3.5rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-[var(--fg-primary)]"
          >
            Build your first neon motion video
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[1.05rem] leading-relaxed text-[var(--fg-muted)]">
            AI creates. JSON keeps it editable. Audio makes it move. Neon makes
            it unforgettable.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <GlowButton href="/register">Start for free</GlowButton>
            <GlowButton href="/login" variant="secondary">
              Log in
            </GlowButton>
            <GlowButton href="#showcase" variant="secondary">
              View Examples
            </GlowButton>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
