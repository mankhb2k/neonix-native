"use client";

import {
  Activity,
  Boxes,
  Clapperboard,
  Database,
  FileJson,
  KeyRound,
  LayoutTemplate,
  Mic,
  Music2,
  Sparkles,
  Type,
  Wand2,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const USE_CASES = [
  [
    "Neon music visualizers",
    "Pulse rings, bars, and glows locked to the beat.",
    Music2,
  ],
  [
    "Cyberpunk YouTube stories",
    "Cinematic HUD scenes for narrative videos.",
    Clapperboard,
  ],
  [
    "Glowing lyric & title videos",
    "Word-timed captions with neon type treatment.",
    Type,
  ],
  [
    "Claude-authored motion templates",
    "Reusable components Claude can compose through MCP.",
    Wand2,
  ],
  ["Podcast & reel visuals", "Audio-reactive loops for vertical feeds.", Mic],
  ["Brand intros & outros", "On-brand glow stings for every channel.", Sparkles],
] as const;

const FEATURES = [
  ["MCP-first JSON protocol", "Strict, editable motion document.", FileJson],
  ["Neon & cyber effects", "Glow, inner-glow, noise, and blur.", Zap],
  ["Reusable components", "Templates with safe, swappable props.", Boxes],
  ["Beat-synced motion", "Keyframes generated from audio analysis.", Activity],
  ["Timeline keyframes", "Frame-accurate property animation.", KeyRound],
  ["R2 managed assets", "Deterministic, project-scoped storage.", Database],
  ["Production renderer", "Pixel-identical export to MP4.", Clapperboard],
  ["Template system", "Character, HUD, and visualizer kits.", LayoutTemplate],
] as const;

const PAINS = [
  "Complex timelines",
  "Manual keyframes",
  "Hard-to-customize templates",
  "AI can't export editor-ready files",
  "Music videos need beat-synced motion",
];

const EFFECTS = [
  "Outer Glow",
  "Inner Glow",
  "Noise Grain",
  "Cyber Stroke",
  "Blend Modes",
  "Color Adjust",
];

const TEMPLATES = [
  ["Character", "color Â· text Â· pose"],
  ["Visualizer", "audio Â· palette Â· shape"],
  ["Cyber HUD", "metrics Â· layout Â· glow"],
  ["Intro / Outro", "logo Â· brand Â· timing"],
] as const;

const GALLERY = [
  "Neon DJ visualizer",
  "Cyber UI explainer",
  "Glowing quote video",
  "Futuristic product promo",
  "Storytelling character scene",
];

const FLOW_A = ["Prompt", "JSON", "Compile", "Render"];
const FLOW_B = [
  "Upload audio",
  "Analyze beat",
  "Generate keyframes",
  "Render neon video",
];

const WAVEFORM = Array.from({ length: 64 }, (_, i) => {
  const t = i / 63;
  return Math.min(
    1,
    0.25 +
      0.2 * Math.sin(t * Math.PI * 5) +
      (i % 8 === 0 ? 0.5 + 0.5 * Math.abs(Math.sin(i)) : 0),
  );
});

function Section({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-20 sm:py-28",
        className,
      )}
    >
      {children}
    </section>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-[var(--accent-text)]">
      {children}
    </p>
  );
}

function Heading({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      style={{ fontFamily: "var(--font-display)" }}
      className={cn(
        "text-[clamp(1.75rem,4vw,2.75rem)] font-semibold leading-[1.15] tracking-[-0.02em] text-[var(--fg-primary)]",
        className,
      )}
    >
      {children}
    </h2>
  );
}

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (
      !element ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
        className,
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-6 backdrop-blur-md transition duration-200 hover:-translate-y-0.5 hover:border-[var(--neon-cyan-loud)] hover:shadow-[0_0_35px_rgba(34,211,238,0.18)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Hud({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative rounded-lg border border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--bg-surface)_82%,transparent)] p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Button({
  href,
  children,
  secondary = false,
}: {
  href: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  return (
    <a
      href={href}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-full border px-4 text-[14px] font-semibold no-underline transition duration-200",
        secondary
          ? "border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--glass-surface)_55%,transparent)] text-[var(--fg-primary)] hover:border-[var(--neon-cyan-loud)]"
          : "border-transparent bg-[var(--accent)] text-[var(--accent-on)] shadow-[0_0_0_1px_rgba(34,211,238,0.3),0_6px_22px_var(--landing-glow-cyan)] hover:bg-[var(--accent-hover)]",
      )}
    >
      {children}
    </a>
  );
}

function Backdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage:
          "linear-gradient(to right, rgba(59,130,246,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(59,130,246,0.07) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
        maskImage: "linear-gradient(to bottom, black, transparent)",
      }}
    />
  );
}

function Scanlines() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage:
          "repeating-linear-gradient(0deg, transparent 0 2px, var(--scanline) 2px 3px)",
      }}
    />
  );
}

function Waveform() {
  return (
    <svg
      viewBox="0 0 320 64"
      className="block h-16 w-full"
      preserveAspectRatio="none"
      aria-hidden
    >
      {WAVEFORM.map((value, i) => (
        <rect
          // Waveform bars are decorative and have no stable domain identity.
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          x={i * 5}
          y={(64 - Math.max(2, value * 64)) / 2}
          width="3"
          height={Math.max(2, value * 64)}
          rx="1"
          fill="var(--accent)"
          opacity={0.35 + value * 0.65}
        />
      ))}
    </svg>
  );
}

function JsonSpecimen({ code }: { code: string }) {
  return (
    <pre className="m-0 overflow-x-auto whitespace-pre text-[12.5px] leading-relaxed text-[var(--fg-muted)]">
      {code}
    </pre>
  );
}

function BeatPulse() {
  const ring = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const beat = Math.exp(-(((now - start) / 1000) % 0.5) * 14);
      ring.current?.style.setProperty(
        "transform",
        `scale(${(1 + beat * 0.1).toFixed(4)})`,
      );
      glow.current?.style.setProperty(
        "opacity",
        (0.35 + beat * 0.65).toFixed(3),
      );
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="relative grid h-[300px] w-full place-items-center sm:h-[380px]">
      <div
        ref={glow}
        className="absolute h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.5),rgba(34,211,238,0)_70%)]"
      />
      <div
        ref={ring}
        className="relative h-40 w-40 rounded-full border-2 border-[var(--accent)] will-change-transform"
        style={{
          boxShadow:
            "0 0 30px rgba(34,211,238,0.6), inset 0 0 30px rgba(34,211,238,0.4)",
        }}
      />
      <div className="absolute h-28 w-28 rounded-full border border-[var(--accent-magenta)]" />
      <span className="absolute font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--fg-muted)]">
        beat sync
      </span>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <Backdrop />
      <Scanlines />
      <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-6 py-20 sm:py-28 lg:grid-cols-2 lg:items-center">
        <div>
          <Eyebrow>Neon cyberpunk video generator</Eyebrow>
          <h1
            style={{ fontFamily: "var(--font-display)" }}
            className="mt-4 text-[clamp(2.5rem,6vw,4.25rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-[var(--fg-primary)]"
          >
            Create Neon Motion Videos with Claude and MCP
          </h1>
          <p className="mt-5 max-w-xl text-[1.05rem] leading-relaxed text-[var(--fg-muted)]">
            Build cyberpunk music visualizers, story videos, glowing titles,
            and animated templates with a strict, editable motion format.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button href="/register">Start for free</Button>
            <Button href="/login" secondary>
              Log in
            </Button>
            <Button href="#showcase" secondary>
              Watch Demo
            </Button>
          </div>
        </div>
        <BeatPulse />
      </div>
    </section>
  );
}

function Problem() {
  return (
    <Section>
      <Reveal>
        <Eyebrow>The problem</Eyebrow>
        <Heading className="mt-3 max-w-2xl">
          Making motion graphics is still too manual.
        </Heading>
      </Reveal>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PAINS.map((pain, i) => (
          <Reveal key={pain} delay={i * 60}>
            <Hud>
              <span className="font-mono text-[11px] text-[var(--fg-muted)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="mt-2 text-[15px] font-medium text-[var(--fg-primary)]">
                {pain}
              </p>
            </Hud>
          </Reveal>
        ))}
        <Reveal delay={PAINS.length * 60}>
          <Hud className="flex items-center justify-center">
            <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-[var(--accent-magenta)]">
              Sound familiar?
            </p>
          </Hud>
        </Reveal>
      </div>
    </Section>
  );
}

function CorePromise() {
  const pillars = [
    [
      "AI generates structured JSON",
      "A strict, editable motion document â€” not a black box.",
    ],
    [
      "Components keep templates reusable",
      "Swap colors, text, and media without breaking internals.",
    ],
    [
      "Audio analysis creates beat-synced keyframes",
      "Beats, bass energy, and loudness mapped to motion automatically.",
    ],
  ];

  return (
    <Section className="border-y border-[var(--glass-border)] bg-[var(--landing-bg-deep)]">
      <div className="mx-auto max-w-3xl text-center">
        <Reveal>
          <Eyebrow>Core promise</Eyebrow>
          <Heading className="mt-3">
            Describe the video. Neonix turns it into editable motion.
          </Heading>
        </Reveal>
      </div>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {pillars.map(([title, desc], i) => (
          <Reveal key={title} delay={i * 80}>
            <Card className="h-full">
              <span className="font-mono text-[11px] text-[var(--accent-text)]">
                0{i + 1}
              </span>
              <h3 className="mt-3 text-[17px] font-semibold text-[var(--fg-primary)]">
                {title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--fg-muted)]">
                {desc}
              </p>
            </Card>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function UseCases() {
  return (
    <Section>
      <Reveal>
        <Eyebrow>Use cases</Eyebrow>
        <Heading className="mt-3 max-w-2xl">
          From beats to brand â€” one motion format.
        </Heading>
      </Reveal>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {USE_CASES.map(([title, desc, Icon], i) => (
          <Reveal key={title} delay={i * 60}>
            <Card className="h-full">
              <Icon
                className="h-5 w-5 text-[var(--accent)]"
                strokeWidth={1.5}
              />
              <h3 className="mt-4 text-[16px] font-semibold text-[var(--fg-primary)]">
                {title}
              </h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--fg-muted)]">
                {desc}
              </p>
            </Card>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function Flow({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div>
      <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">
        {title}
      </p>
      <ol className="mt-4 flex flex-wrap items-center gap-2">
        {steps.map((step, i) => (
          <li key={step} className="flex items-center gap-2">
            <Hud className="flex items-center gap-3 px-4 py-3">
              <span className="font-mono text-[11px] text-[var(--accent-text)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-[14px] font-medium text-[var(--fg-primary)]">
                {step}
              </span>
            </Hud>
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className="font-mono text-[var(--accent-magenta)]"
              >
                â†’
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function HowItWorks() {
  return (
    <Section className="border-y border-[var(--glass-border)]">
      <Reveal>
        <Eyebrow>How it works</Eyebrow>
        <Heading className="mt-3 max-w-2xl">
          Prompt to render, or audio to neon.
        </Heading>
      </Reveal>
      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <Reveal>
          <Flow title="From a prompt" steps={FLOW_A} />
        </Reveal>
        <Reveal delay={80}>
          <Flow title="From music" steps={FLOW_B} />
        </Reveal>
      </div>
    </Section>
  );
}

function Features() {
  return (
    <Section>
      <Reveal>
        <Eyebrow>Features</Eyebrow>
        <Heading className="mt-3 max-w-2xl">
          Everything a motion format should do.
        </Heading>
      </Reveal>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(([title, desc, Icon], i) => (
          <Reveal key={title} delay={i * 50}>
            <Card className="h-full">
              <Icon
                className="h-5 w-5 text-[var(--accent)]"
                strokeWidth={1.5}
              />
              <h3 className="mt-4 text-[15px] font-semibold text-[var(--fg-primary)]">
                {title}
              </h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--fg-muted)]">
                {desc}
              </p>
            </Card>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function Effects() {
  return (
    <Section
      id="showcase"
      className="border-y border-[var(--glass-border)] bg-[var(--landing-bg-deep)]"
    >
      <div className="mx-auto max-w-3xl text-center">
        <Reveal>
          <Eyebrow>Neon effects</Eyebrow>
          <Heading className="mt-3">
            Built for light, glow, rhythm, and atmosphere.
          </Heading>
        </Reveal>
      </div>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EFFECTS.map((effect, i) => (
          <Reveal key={effect} delay={i * 60}>
            <div className="group relative grid h-44 place-items-center overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--landing-bg-deep)]">
              <div className="h-20 w-20 rounded-xl border border-[var(--accent)] bg-[linear-gradient(135deg,rgba(34,211,238,0.5),transparent)] shadow-[0_0_30px_rgba(34,211,238,0.4)]" />
              <span className="absolute bottom-3 left-3 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">
                {effect}
              </span>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function AudioReactive() {
  return (
    <Section className="bg-[var(--landing-bg-purple)]">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <Reveal>
            <Eyebrow>Audio-reactive</Eyebrow>
            <Heading className="mt-3">Make visuals move with the music</Heading>
            <p className="mt-4 max-w-lg text-[1.05rem] leading-relaxed text-[var(--fg-muted)]">
              Analyze beats, bass energy, loudness, and sections to generate
              timeline keyframes automatically.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <div className="mt-6 flex flex-wrap gap-2">
              {["Beats", "Bass energy", "Loudness", "Sections"].map(
                (signal) => (
                  <span
                    key={signal}
                    className="rounded-full border border-[var(--accent)] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--accent)]"
                  >
                    {signal}
                  </span>
                ),
              )}
            </div>
          </Reveal>
        </div>
        <Reveal delay={80}>
          <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--landing-bg-deep)] p-6">
            <Waveform />
            <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">
              waveform Â· beat markers Â· glow pulse
            </p>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

function Templates() {
  return (
    <Section className="border-y border-[var(--glass-border)]">
      <div className="mx-auto max-w-3xl text-center">
        <Reveal>
          <Eyebrow>Templates &amp; components</Eyebrow>
          <Heading className="mt-3">
            Templates that AI can actually control
          </Heading>
          <p className="mt-4 text-[1.05rem] leading-relaxed text-[var(--fg-muted)]">
            Change colors, text, images, and motion without breaking
            internals.
          </p>
        </Reveal>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TEMPLATES.map(([name, props], i) => (
          <Reveal key={name} delay={i * 70}>
            <Card className="h-full">
              <h3 className="text-[16px] font-semibold text-[var(--fg-primary)]">
                {name}
              </h3>
              <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--accent-magenta)]">
                {props}
              </p>
            </Card>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function JsonTrust() {
  const code =
    '{"format":"motion-project","formatVersion":2,"layers":[{"id":"ring","type":"shape"}]}';

  return (
    <Section className="border-y border-[var(--glass-border)]">
      <div className="mx-auto max-w-3xl text-center">
        <Reveal>
          <Eyebrow>Developer trust</Eyebrow>
          <Heading className="mt-3">Structured motion, not prompt soup</Heading>
          <p className="mt-4 text-[1.05rem] leading-relaxed text-[var(--fg-muted)]">
            Every video is backed by a strict, editable motion document.
          </p>
        </Reveal>
      </div>
      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        <Reveal>
          <Card>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">
              Prompt
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-[var(--fg-secondary)]">
              â€œA neon ring that pulses with the kick drum over a dark cyber
              grid.â€
            </p>
          </Card>
        </Reveal>
        <Reveal delay={80}>
          <Card className="bg-[var(--code-block-bg)]">
            <JsonSpecimen code={code} />
          </Card>
        </Reveal>
        <Reveal delay={160}>
          <Card className="grid h-full place-items-center">
            <div className="h-24 w-24 rounded-full border-2 border-[var(--accent)] shadow-[0_0_30px_rgba(34,211,238,0.6),inset_0_0_30px_rgba(34,211,238,0.4)]" />
            <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">
              rendered video
            </p>
          </Card>
        </Reveal>
      </div>
    </Section>
  );
}

function Gallery() {
  return (
    <Section>
      <Reveal>
        <Eyebrow>Gallery</Eyebrow>
        <Heading className="mt-3 max-w-2xl">See what Neonix renders.</Heading>
      </Reveal>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GALLERY.map((item, i) => (
          <Reveal key={item} delay={i * 60}>
            <div className="group relative aspect-video overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--landing-bg-deep)]">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(34,211,238,0.14),transparent_70%)]" />
              <span className="absolute bottom-3 left-3 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">
                {item}
              </span>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-[var(--glass-border)]">
      <Backdrop />
      <Scanlines />
      <div className="relative mx-auto w-full max-w-3xl px-6 py-24 text-center sm:py-32">
        <Reveal>
          <h2
            style={{ fontFamily: "var(--font-display)" }}
            className="text-[clamp(2.25rem,5vw,3.5rem)] font-semibold leading-[1.1] text-[var(--fg-primary)]"
          >
            Build your first neon motion video
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[1.05rem] leading-relaxed text-[var(--fg-muted)]">
            AI creates. JSON keeps it editable. Audio makes it move. Neon
            makes it unforgettable.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button href="/register">Start for free</Button>
            <Button href="/login" secondary>
              Log in
            </Button>
            <Button href="#showcase" secondary>
              View Examples
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function LandingPage() {
  return (
    <main>
      <Hero />
      <Problem />
      <CorePromise />
      <UseCases />
      <HowItWorks />
      <Features />
      <Effects />
      <AudioReactive />
      <Templates />
      <JsonTrust />
      <Gallery />
      <FinalCta />
    </main>
  );
}
