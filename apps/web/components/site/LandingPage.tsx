"use client";

import {
  Braces,
  Check,
  Code2,
  Layers3,
  Network,
  Play,
  ScanSearch,
  Sparkles,
  Workflow as WorkflowIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

function Reveal({
  children,
  delay = 0,
}: {
  children: ReactNode;
  delay?: number;
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
      { threshold: 0.12 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${visible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function Section({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`mx-auto w-full max-w-6xl px-6 py-20 sm:py-28 ${className}`}
    >
      {children}
    </section>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-text)]">
      {children}
    </p>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-[-0.025em] text-[var(--fg-primary)] sm:text-5xl">
      {children}
    </h2>
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
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold no-underline transition ${secondary ? "border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--fg-primary)] hover:border-[var(--accent)]" : "border-transparent bg-[var(--accent)] text-[var(--accent-on)] shadow-sm hover:bg-[var(--accent-hover)]"}`}
    >
      {children}
    </a>
  );
}

function CompilerShowcase() {
  const [tab, setTab] = useState<"html" | "css" | "json">("html");
  const code = {
    html: `<main class="hero-card">\n  <span>NEONIX</span>\n  <h1>Make it move.</h1>\n</main>`,
    css: `.hero-card {\n  width: 720px;\n  padding: 64px;\n  border-radius: 28px;\n  background: linear-gradient(135deg, #0f766e, #2563eb);\n  color: white;\n}`,
    json: `{\n  "composition": "hero-card",\n  "layers": [\n    { "id": "title", "type": "text", "text": "Make it move." },\n    { "id": "pulse", "type": "shape", "animation": "pulse" }\n  ]\n}`,
  } as const;
  return (
    <div className="mx-auto mt-12 grid max-w-5xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--bg-site)] text-left shadow-[0_24px_70px_rgba(16,24,40,0.12)]">
      <div className="flex min-h-11 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-site)] px-4">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#F97066]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#FEC84B]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#32D583]" />
          <span className="ml-3 font-mono text-[10px] text-[var(--fg-muted)]">
            project.html · motion-preview
          </span>
        </div>
        <span className="font-mono text-[10px] text-[var(--success)]">
          ● ready
        </span>
      </div>
      <div className="grid min-h-[400px] items-stretch gap-0 bg-[var(--bg-site)] lg:grid-cols-[1.35fr_0.65fr]">
        <div className="flex min-w-0 flex-col overflow-hidden border-r border-[var(--border-subtle)] bg-[var(--bg-site)] lg:order-1">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--accent-text)]">
              Source
            </span>
            <div className="flex gap-1">
              {(["html", "css", "json"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setTab(item)}
                  className={`rounded-md px-2.5 py-1.5 font-mono text-[10px] uppercase transition ${tab === item ? "bg-[var(--accent-soft)] text-[var(--accent-text)]" : "text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]"}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <pre className="m-0 min-h-0 flex-1 overflow-auto p-6 font-mono text-xs leading-6 text-[var(--fg-secondary)] sm:p-10">
            {code[tab]}
          </pre>
        </div>
        <div className="flex h-full items-center justify-center bg-[var(--bg-site)] p-6 sm:p-10 lg:order-2">
          <div
            className="relative h-auto aspect-[9/16] w-[180px] shrink-0 overflow-hidden rounded-[20px] border-[6px] border-[#1D2939] bg-[#101828] shadow-[0_20px_35px_rgba(16,24,40,0.22)] sm:w-[210px]"
            style={{ aspectRatio: "9 / 16" }}
          >
            <div className="absolute inset-0 bg-[linear-gradient(145deg,#101828_0%,#263B4B_52%,#7F3D36_100%)]" />
            <div className="absolute inset-x-4 top-8 h-24 rounded-full border border-[#98F5E8]/50 shadow-[0_0_30px_rgba(152,245,232,0.32)]" />
            <div className="absolute inset-x-5 top-14 h-12 rounded-full border-2 border-[#FBBF24] opacity-80" />
            <div className="absolute inset-x-5 bottom-9">
              <span className="font-mono text-[8px] tracking-[0.18em] text-[#B8FFF5]">
                NEONIX / 001
              </span>
              <strong className="mt-2 block text-xl font-semibold leading-none text-white">
                Make it
                <br />
                move.
              </strong>
              <span className="mt-3 block h-1 w-10 rounded-full bg-[#FBBF24]" />
            </div>
            <span className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-[#F97066] shadow-[0_0_10px_#F97066]" />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--border-subtle)] px-4 py-3 font-mono text-[10px] text-[var(--fg-muted)]">
        <span>HTML + CSS</span>
        <span>→</span>
        <span>semantic JSON</span>
        <span>→</span>
        <span>editable motion</span>
      </div>
    </div>
  );
}

const CAPABILITIES = [
  [
    "HTML & CSS",
    "Start with familiar markup, layout, paint and typography.",
    Layers3,
  ],
  [
    "Tailwind & components",
    "Bring utility classes, reusable components and templates into the same motion workflow.",
    Code2,
  ],
  [
    "Atomic semantics",
    "Turn visual intent into named layers and independently editable properties.",
    Braces,
  ],
  [
    "Agent-ready projects",
    "Let agents create and update a project while people keep the final say.",
    WorkflowIcon,
  ],
] as const;

function McpConnection() {
  const providers = [
    ["C", "Claude", "bg-[#F4C2A1] text-[#5B2C1D]"],
    ["G", "ChatGPT", "bg-[#D9F99D] text-[#365314]"],
    ["O", "OpenClaw", "bg-[#BFDBFE] text-[#1E3A8A]"],
    ["G", "Grok", "bg-[#E9D5FF] text-[#581C87]"],
  ] as const;

  return (
    <div className="mx-auto mt-10 max-w-5xl">
      <div className="flex flex-col items-center">
        <div className="flex h-[58px] items-center gap-3 rounded-xl border border-[var(--fg-primary)] bg-[var(--fg-primary)] px-6 text-base font-semibold text-white shadow-sm">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/15 text-sm">
            N
          </span>
          Neonix
        </div>
        <span
          className="h-10 border-l border-[var(--border-strong)]"
          aria-hidden
        />
        <div className="flex h-[58px] items-center gap-3 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-6 text-base font-semibold text-[var(--accent-text)]">
          <Network className="h-5 w-5" /> MCP
        </div>
        <span
          className="h-10 border-l border-[var(--border-strong)]"
          aria-hidden
        />
        <div className="relative grid w-full grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
          <span
            className="absolute left-1/2 top-0 hidden h-px w-3/4 -translate-x-1/2 bg-[var(--border-strong)] sm:block"
            aria-hidden
          />
          {providers.map(([mark, name, markClass]) => (
            <div
              key={name}
              className="relative flex justify-center pt-7 before:absolute before:left-1/2 before:top-0 before:h-7 before:border-l before:border-[var(--border-strong)]"
            >
              <div className="flex h-[58px] w-full items-center justify-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-site)] px-3 text-sm font-semibold text-[var(--fg-primary)] shadow-[0_8px_20px_rgba(16,24,40,0.05)]">
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm ${markClass}`}
                >
                  {mark}
                </span>
                <span>{name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="mx-auto mt-4 max-w-xl text-center text-xs leading-relaxed text-[var(--fg-muted)]">
        Neonix gives Claude, ChatGPT, OpenClaw and Grok one MCP connection for
        creating and updating motion projects.
      </p>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-[var(--border-subtle)] bg-[var(--bg-site)]">
      <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-28 text-center sm:pb-32 sm:pt-36">
        <div className="mx-auto max-w-4xl">
          <Eyebrow>HTML/CSS compiler for motion</Eyebrow>
          <h1 className="mx-auto mt-5 max-w-4xl text-5xl font-semibold leading-[0.98] tracking-[-0.045em] text-[var(--fg-primary)] sm:text-7xl lg:text-[5.5rem]">
            The motion layer
            <br />
            <span className="text-[var(--accent-text)]">for AI agents.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[var(--fg-secondary)]">
            Neonix connects Claude and ChatGPT through MCP, turning familiar
            HTML/CSS into structured motion projects you can preview, edit and
            export.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button href="/docs/preview/html-compiler">
              <Play className="h-4 w-4" /> Try the compiler
            </Button>
            <Button href="#workflow" secondary>
              See how it works
            </Button>
          </div>
        </div>
        <McpConnection />
        <CompilerShowcase />
      </div>
    </section>
  );
}

function Workflow() {
  const steps = [
    [
      "01",
      "Connect",
      "Connect Neonix through MCP in one click. No local renderer or project setup required.",
    ],
    [
      "02",
      "Create",
      "Let an agent turn HTML, CSS, Tailwind and components into named motion layers.",
    ],
    [
      "03",
      "Edit & export",
      "Preview the result, adjust any property, then export when it is ready.",
    ],
  ];
  return (
    <Section id="workflow" className="border-b border-[var(--border-subtle)]">
      <Reveal>
        <Eyebrow>The agent-ready motion stack</Eyebrow>
        <Heading>From agent prompt to editable motion.</Heading>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--fg-secondary)]">
          Neonix gives AI agents a direct path from intent to motion graphics: a
          project people can inspect, refine and ship instead of a flattened
          render.
        </p>
      </Reveal>
      <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--border-subtle)] md:grid-cols-3">
        {steps.map(([number, title, description], index) => (
          <Reveal key={title} delay={index * 70}>
            <div className="h-full bg-[var(--bg-elevated)] p-6">
              <span className="font-mono text-xs text-[var(--accent-text)]">
                {number}
              </span>
              <h3 className="mt-8 text-lg font-semibold text-[var(--fg-primary)]">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)]">
                {description}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function Capabilities() {
  return (
    <Section>
      <Reveal>
        <Eyebrow>Made for web-native creators</Eyebrow>
        <Heading>The web is already your design system.</Heading>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--fg-secondary)]">
          Use the primitives your team already knows. Neonix gives them motion
          meaning without forcing a new authoring language.
        </p>
      </Reveal>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {CAPABILITIES.map(([title, description, Icon], index) => (
          <Reveal key={title} delay={index * 70}>
            <article className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-[0_14px_35px_rgba(8,126,139,0.1)]">
              <Icon
                className="h-5 w-5 text-[var(--accent)]"
                strokeWidth={1.7}
              />
              <h3 className="mt-5 text-lg font-semibold text-[var(--fg-primary)]">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)]">
                {description}
              </p>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function StructuredMotion() {
  return (
    <Section className="border-y border-[var(--border-subtle)] bg-[var(--bg-site)]">
      <div className="grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr]">
        <Reveal>
          <Eyebrow>The output</Eyebrow>
          <Heading>Video data you can actually work with.</Heading>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-[var(--fg-secondary)]">
            Neonix turns HTML/CSS into semantic, atomic JSON: named layers,
            properties and relationships that can be edited by a person, an
            agent or a template system.
          </p>
          <div className="mt-7 space-y-3 text-sm text-[var(--fg-secondary)]">
            {[
              "Named elements instead of flattened frames",
              "Properties you can target independently",
              "Reusable components and templates",
            ].map((item) => (
              <p key={item} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[var(--accent)]" />
                {item}
              </p>
            ))}
          </div>
        </Reveal>
        <Reveal delay={100}>
          <div className="overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[#15212A] p-5 shadow-[0_20px_45px_rgba(16,24,40,0.16)]">
            <div className="mb-4 flex items-center gap-2 font-mono text-[10px] text-[#9FE7E0]">
              <Braces className="h-3.5 w-3.5" /> normalized-motion.json
            </div>
            <pre className="m-0 overflow-auto font-mono text-xs leading-7 text-[#D9E7EE]">
              {
                '{\n  "composition": "hero-card",\n  "layers": [\n    { "id": "title", "type": "text", "text": "Make it move." },\n    { "id": "pulse", "type": "shape", "animation": "pulse" }\n  ]\n}'
              }
            </pre>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

function AgentWorkflow() {
  return (
    <Section className="border-b border-[var(--border-subtle)]">
      <Reveal>
        <Eyebrow>Built for agent workflows</Eyebrow>
        <Heading>Less plumbing. More motion.</Heading>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--fg-secondary)]">
          Connect your agent to a Neonix workspace, let it create or update the
          project, then take over in the editor whenever you want precision.
        </p>
      </Reveal>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        <Reveal>
          <article className="h-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6">
            <Network className="h-5 w-5 text-[var(--accent)]" />
            <h3 className="mt-5 font-semibold text-[var(--fg-primary)]">
              MCP in one click
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)]">
              Connect Claude, ChatGPT, OpenClaw or Grok directly to a Neonix
              workspace without a local render setup.
            </p>
          </article>
        </Reveal>
        <Reveal delay={70}>
          <article className="h-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6">
            <Sparkles className="h-5 w-5 text-[var(--accent)]" />
            <h3 className="mt-5 font-semibold text-[var(--fg-primary)]">
              Create, update, refine
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)]">
              Agents can create a project and update specific layers instead of
              replacing the whole render.
            </p>
          </article>
        </Reveal>
        <Reveal delay={140}>
          <article className="h-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6">
            <ScanSearch className="h-5 w-5 text-[var(--accent)]" />
            <h3 className="mt-5 font-semibold text-[var(--fg-primary)]">
              Hand off to humans
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)]">
              Open the same project in the editor, make precise changes and
              export when it is ready.
            </p>
          </article>
        </Reveal>
      </div>
    </Section>
  );
}

function Comparison() {
  const rows = [
    ["Starting point", "HTML/CSS and agent intent", "React components and code"],
    ["Authoring", "Agents, templates and visual editing", "Developers in a codebase"],
    ["Output", "Semantic, editable motion data", "A programmatic video composition"],
    ["Best for", "Agent-first video tools and reusable motion systems", "Code-first video generation with React"],
  ];

  return (
    <Section id="comparison" className="border-b border-[var(--border-subtle)]">
      <Reveal>
        <Eyebrow>Choose the right layer</Eyebrow>
        <Heading>Neonix and Remotion solve different problems.</Heading>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--fg-secondary)]">
          Remotion is a powerful code-first framework for rendering video with
          React. Neonix is an agent-first motion workspace for turning web
          primitives into editable projects.
        </p>
      </Reveal>
      <Reveal delay={90}>
        <div className="mt-10 overflow-x-auto rounded-xl border border-[var(--border-strong)]">
          <table className="w-full min-w-[680px] border-collapse text-left text-sm">
            <thead className="bg-[var(--bg-elevated)] text-[var(--fg-primary)]">
              <tr>
                <th className="w-1/4 border-b border-[var(--border-subtle)] px-5 py-4 font-medium text-[var(--fg-muted)]">
                  &nbsp;
                </th>
                <th className="border-b border-[var(--border-subtle)] px-5 py-4 text-[var(--accent-text)]">
                  Neonix
                </th>
                <th className="border-b border-[var(--border-subtle)] px-5 py-4">
                  Remotion
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, neonix, remotion]) => (
                <tr key={label} className="bg-[var(--bg-site)]">
                  <th className="border-b border-[var(--border-subtle)] px-5 py-4 font-medium text-[var(--fg-primary)]">
                    {label}
                  </th>
                  <td className="border-b border-[var(--border-subtle)] px-5 py-4 text-[var(--fg-secondary)]">
                    {neonix}
                  </td>
                  <td className="border-b border-[var(--border-subtle)] px-5 py-4 text-[var(--fg-secondary)]">
                    {remotion}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>
    </Section>
  );
}

function FinalCta() {
  return (
    <section className="border-t border-[var(--border-subtle)] bg-[var(--bg-site)]">
      <div className="mx-auto max-w-4xl px-6 py-24 text-center">
        <Eyebrow>Give your agent a motion layer</Eyebrow>
        <h2 className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-[var(--fg-primary)] sm:text-6xl">
          Turn your next idea into editable video.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[var(--fg-secondary)]">
          Connect Neonix through MCP and move from familiar web source to a
          motion project you can preview, edit and export.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button href="/docs/preview/html-compiler">
            Open compiler preview
          </Button>
          <Button href="/docs" secondary>
            Read the docs
          </Button>
        </div>
      </div>
    </section>
  );
}

export function LandingPage() {
  return (
    <main className="bg-[var(--bg-site)] text-[var(--fg-primary)]">
      <Hero />
      <Workflow />
      <Capabilities />
      <StructuredMotion />
      <AgentWorkflow />
      <Comparison />
      <FinalCta />
    </main>
  );
}
