import { Section } from "./primitives/Section";
import { SectionEyebrow } from "./primitives/SectionEyebrow";
import { SectionHeading } from "./primitives/SectionHeading";
import { Reveal } from "./primitives/Reveal";
import { GALLERY } from "./data";

function GalleryItem({ label }: { label: string }) {
  return (
    <div className="group relative aspect-video overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--landing-bg-deep)] transition duration-200 hover:border-[var(--neon-cyan-loud)]">
      {/* placeholder thumb — real video in Phase 3 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(34,211,238,0.14) 0%, transparent 70%)",
        }}
      />
      <span className="absolute bottom-3 left-3 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--fg-muted)] group-hover:text-[var(--fg-primary)]">
        {label}
      </span>
    </div>
  );
}

export function GallerySection() {
  return (
    <Section>
      <Reveal>
        <SectionEyebrow>Gallery</SectionEyebrow>
        <SectionHeading className="mt-3 max-w-2xl">
          See what Neonix renders.
        </SectionHeading>
      </Reveal>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GALLERY.map((item, i) => (
          <Reveal key={item} delay={i * 60}>
            <GalleryItem label={item} />
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
