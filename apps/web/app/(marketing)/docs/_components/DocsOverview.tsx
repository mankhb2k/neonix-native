import { ArrowRight, Braces, Clock3, Layers3, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";

const pillars = [
  {
    number: "01",
    icon: Braces,
    eyebrow: "Document",
    title: "A strict JSON contract",
    body: "A composition, assets, layers, definitions and audio live in one renderer-neutral document.",
    href: "/docs/atoms",
  },
  {
    number: "02",
    icon: Layers3,
    eyebrow: "Layers",
    title: "SVG semantics, preserved",
    body: "Groups, shapes, paths, text, images and video stay readable before compilation.",
    href: "/docs/atoms/layers",
  },
  {
    number: "03",
    icon: Clock3,
    eyebrow: "Animation",
    title: "Time is data",
    body: "Timing windows and typed tracks target explicit properties with deterministic easing.",
    href: "/docs/animation",
  },
  {
    number: "04",
    icon: ShieldCheck,
    eyebrow: "Validation",
    title: "Safe to hand off",
    body: "Schema validation rejects unknown fields and invalid references before a document is accepted.",
    href: "/docs/validation",
  },
];

const pipeline = [
  ["01", "HTML / CSS / agent intent", "the authoring input"],
  ["02", "Compiler", "validation and normalization"],
  ["03", "Neonix JSON V2", "canonical editable JSON"],
  ["04", "Output", "preview or video export"],
];

export function DocsOverview() {
  return (
    <article className="pb-20">
      <section className="relative overflow-hidden rounded-[28px] border border-[#cfe5e0] bg-[#eefaf7] px-6 py-10 shadow-[0_20px_70px_rgba(13,148,136,0.08)] md:px-10 md:py-14">
        <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[#79e7ff]/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-[#3aedae]/20 blur-3xl" />
        <div className="relative max-w-3xl">
          <div className="mb-5 flex items-center gap-2 font-mono text-sm font-semibold tracking-[0.18em] text-[#087f73] uppercase">
            <span className="h-2 w-2 rounded-full bg-[#0d9488] shadow-[0_0_12px_#0d9488]" />
            Neonix / Neonix JSON
          </div>
          <h1 className="max-w-2xl text-4xl font-semibold leading-[0.98] tracking-[-0.055em] text-[#102a2a] md:text-6xl">
            Author motion as data.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-[#3e5b5a] md:text-lg">
            Neonix JSON V2 is Neonix&apos;s strict, renderer-neutral JSON for turning web intent into editable motion. Learn the document model, animate any atomic property, and keep preview and export on the same meaning.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/docs/atoms" className="inline-flex items-center gap-2 rounded-full bg-[#0d9488] px-4 py-2.5 text-sm font-semibold text-white no-underline shadow-[0_8px_20px_rgba(13,148,136,0.2)] hover:bg-[#0f766e]">
            Explore Neonix JSON <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/docs/examples/project" className="inline-flex items-center gap-2 rounded-full border border-[#b7d5cf] bg-white/70 px-4 py-2.5 text-sm font-semibold text-[#175a55] no-underline hover:bg-white">
              See a complete JSON project
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-sm font-semibold tracking-[0.16em] text-[#0d9488] uppercase">The mental model</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-[var(--fg-primary)] md:text-3xl">Four steps from intent to output.</h2>
          </div>
          <Zap className="hidden h-6 w-6 text-[#0d9488] md:block" />
        </div>
        <div className="mt-5 grid gap-px overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--border-subtle)] md:grid-cols-4">
          {pipeline.map(([number, title, body], index) => (
            <div key={title} className="bg-[var(--bg-elevated)] p-4 md:min-h-32">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold text-[#0d9488]">{number}</span>
                {index < pipeline.length - 1 ? <span className="hidden text-[var(--fg-muted)] md:block">→</span> : null}
              </div>
              <h3 className="mt-5 text-base font-semibold text-[var(--fg-primary)]">{title}</h3>
              <p className="mt-1 text-sm leading-5 text-[var(--fg-muted)]">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <div className="grid gap-3 md:grid-cols-2">
          {pillars.map(({ number, icon: Icon, eyebrow, title, body, href }) => (
            <Link key={href} href={href} className="group rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 no-underline transition hover:-translate-y-0.5 hover:border-[#9bd9d0] hover:shadow-[0_12px_32px_rgba(13,148,136,0.08)]">
              <div className="flex items-start justify-between gap-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f8f4] text-[#0d9488]"><Icon className="h-5 w-5" /></span>
                <span className="font-mono text-sm text-[var(--fg-muted)]">{number}</span>
              </div>
              <p className="mt-6 font-mono text-sm font-semibold tracking-[0.16em] text-[#0d9488] uppercase">{eyebrow}</p>
              <h3 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[var(--fg-primary)]">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--fg-secondary)]">{body}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#0d9488]">Read the concept <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-12 grid gap-6 rounded-2xl border border-[#d7dbe4] bg-[#101522] p-5 text-[#e2e8f4] md:grid-cols-[0.8fr_1.2fr] md:p-7">
        <div>
          <p className="font-mono text-sm font-semibold tracking-[0.16em] text-[#6ee7d0] uppercase">Start with the root</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-white">Every project begins with a document.</h2>
          <p className="mt-3 text-sm leading-6 text-[#aeb8ca]">The root establishes the format, composition, assets, layers and audio domains. Everything else is referenced by stable IDs.</p>
          <Link href="/docs/atoms/composition" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#79e7ff] no-underline hover:text-white">Read composition and view <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <pre className="m-0 overflow-x-auto rounded-xl border border-white/10 bg-[#0a0e18] p-4 font-mono text-sm leading-6 text-[#d7e1f0]"><code>{[
          "{",
          '  "format": "motion-protocol",',
          '  "formatVersion": 2,',
          '  "composition": { "width": 1920, "height": 1080, "fps": 30 },',
          '  "assets": [],',
          '  "layers": [],',
          '  "audio": { "sampleRate": 48000, "tracks": [] }',
          "}",
        ].join("\n")}</code></pre>
      </section>
    </article>
  );
}
