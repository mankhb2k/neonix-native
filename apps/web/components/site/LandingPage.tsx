"use client";

import {
  Braces,
  ArrowRight,
  Check,
  Code2,
  Layers3,
  Network,
  Play,
  ScanSearch,
  Sparkles,
  Workflow as WorkflowIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  NEONIX_DEMO_HTML,
  NEONIX_DEMO_JSON,
} from "./neonix-demo-fixture";
import { NeonixMotionPreview } from "./NeonixMotionPreview";

const LANDING_TYPOGRAPHY = {
  eyebrow: "text-xs",
  heading: "text-4xl sm:text-6xl",
  lead: "text-lg",
  cardTitle: "text-xl",
  body: "text-base",
  codeMeta: "text-xs",
  code: "text-sm",
} as const;

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
      className={`mx-auto w-full max-w-[1200px] px-6 py-20 sm:py-28 ${className}`}
    >
      {children}
    </section>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p
      className={`${LANDING_TYPOGRAPHY.eyebrow} font-mono font-semibold uppercase tracking-[0.18em] text-[var(--accent-text)]`}
    >
      {children}
    </p>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <h2
      className={`mt-3 max-w-3xl font-semibold leading-tight tracking-[-0.025em] text-[var(--fg-primary)] ${LANDING_TYPOGRAPHY.heading}`}
    >
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
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-4 text-base font-semibold no-underline transition ${secondary ? "border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--fg-primary)] hover:border-[var(--accent)]" : "border-transparent bg-[var(--accent)] text-[var(--accent-on)] shadow-sm hover:bg-[var(--accent-hover)]"}`}
    >
      {children}
    </a>
  );
}

function CompilerShowcase() {
  const [tab, setTab] = useState<"html" | "json">("html");
  const code = {
    html: NEONIX_DEMO_HTML,
    json: NEONIX_DEMO_JSON,
  } as const;
  return (
    <div className="mx-auto mt-16 grid h-[620px] min-h-0 max-w-[1200px] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-site)] text-left shadow-[0_28px_80px_rgba(16,24,40,0.14)]">
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
      <div className="grid min-h-0 h-full items-stretch gap-0 bg-[var(--bg-site)] lg:grid-cols-[1.35fr_0.65fr]">
        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-[var(--border-subtle)] bg-[var(--bg-site)] lg:order-1">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--accent-text)]">
              Source
            </span>
            <div className="flex gap-1">
              {(["html", "json"] as const).map((item) => (
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
          <pre className="m-0 min-h-0 flex-1 overflow-x-auto overflow-y-auto whitespace-pre p-6 font-mono text-xs leading-6 text-[var(--fg-secondary)] sm:p-10">
            {code[tab]}
          </pre>
        </div>
        <div className="flex min-h-0 h-full items-center justify-center overflow-hidden bg-[var(--bg-site)] p-4 sm:p-6 lg:order-2">
          <NeonixMotionPreview />
        </div>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--border-subtle)] px-4 py-3 font-mono text-[10px] text-[var(--fg-muted)]">
        <span>single-file HTML</span>
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
    ["/logo/claude-logo.svg", "Claude"],
    ["/logo/openai-logo.svg", "ChatGPT"],
    ["/logo/grok-logo.svg", "Grok"],
  ] as const;

  return (
    <div className="mx-auto mt-12 max-w-[1200px]">
      <div className="flex flex-col items-center">
        <div className="flex h-[58px] items-center gap-3 rounded-xl border border-[var(--fg-primary)] bg-[var(--fg-primary)] px-6 text-lg font-semibold text-white shadow-sm">
          <span className="grid h-[34px] w-[34px] place-items-center rounded-lg bg-white/15 p-1.5">
            <Image
              src="/logo/neonix-logo.svg"
              alt=""
              width={20}
              height={20}
              className="h-5 w-5 object-contain"
            />
          </span>
          Neonix
        </div>
        <span
          className="h-10 border-l border-[var(--border-strong)]"
          aria-hidden
        />
        <div className="flex h-[58px] items-center gap-3 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-6 text-lg font-semibold text-[var(--accent-text)]">
          <Network className="h-5 w-5" /> MCP
        </div>
        <span
          className="h-10 border-l border-[var(--border-strong)]"
          aria-hidden
        />
        <div className="relative grid w-full grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6">
          <span
            className="absolute left-1/2 top-0 hidden h-px w-3/4 -translate-x-1/2 bg-[var(--border-strong)] sm:block"
            aria-hidden
          />
          {providers.map(([logoSrc, name]) => (
            <div
              key={name}
              className="relative flex justify-center pt-7 before:absolute before:left-1/2 before:top-0 before:h-7 before:border-l before:border-[var(--border-strong)]"
            >
              <div className="flex h-[58px] w-full items-center justify-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-site)] px-3 text-base font-semibold text-[var(--fg-primary)] shadow-[0_8px_20px_rgba(16,24,40,0.05)]">
                <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-lg bg-[var(--bg-hover)] p-1.5">
                  <Image
                    src={logoSrc}
                    alt=""
                    width={20}
                    height={20}
                    className="h-5 w-5 object-contain"
                  />
                </span>
                <span>{name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="mx-auto mt-4 max-w-xl text-center text-xs leading-relaxed text-[var(--fg-muted)]">
        Neonix gives Claude, ChatGPT and Grok one MCP connection for
        creating and updating motion projects.
      </p>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-[var(--border-subtle)] bg-[var(--bg-site)]">
      <div className="relative mx-auto max-w-[1200px] px-6 pb-20 pt-28 text-center sm:pb-32 sm:pt-36">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/docs/mcp"
            className="mx-auto inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-2 py-1.5 text-sm text-[var(--fg-secondary)] no-underline shadow-sm transition hover:border-[var(--accent)] hover:text-[var(--fg-primary)]"
          >
            <span className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-xs font-medium text-[var(--fg-primary)]">
              new
            </span>
            <span>MCP server for Claude, Grok &amp; ChatGPT</span>
            <ArrowRight className="h-4 w-4 text-[var(--accent-text)]" />
          </Link>
          <h1 className="mx-auto mt-5 max-w-4xl text-5xl font-semibold leading-[0.98] tracking-[-0.045em] text-[var(--fg-primary)] sm:text-7xl lg:text-[5.5rem]">
            The motion layer
            <br />
            <span className="text-[var(--accent-text)]">for AI agents.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[var(--fg-secondary)]">
            Neonix connects Claude, ChatGPT, and Grok through MCP, turning familiar
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
        <p className={`mt-5 max-w-2xl leading-relaxed text-[var(--fg-secondary)] ${LANDING_TYPOGRAPHY.lead}`}>
          Neonix gives AI agents a direct path from intent to motion graphics: a
          project people can inspect, refine and ship instead of a flattened
          render.
        </p>
      </Reveal>
      <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--border-subtle)] md:grid-cols-3">
        {steps.map(([number, title, description], index) => (
          <Reveal key={title} delay={index * 70}>
            <div className="h-full bg-[var(--bg-elevated)] p-6">
              <span className="font-mono text-sm text-[var(--accent-text)]">
                {number}
              </span>
              <h3 className={`mt-8 font-semibold text-[var(--fg-primary)] ${LANDING_TYPOGRAPHY.cardTitle}`}>
                {title}
              </h3>
              <p className={`mt-2 leading-relaxed text-[var(--fg-muted)] ${LANDING_TYPOGRAPHY.body}`}>
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
        <p className={`mt-5 max-w-2xl leading-relaxed text-[var(--fg-secondary)] ${LANDING_TYPOGRAPHY.lead}`}>
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
              <h3 className={`mt-5 font-semibold text-[var(--fg-primary)] ${LANDING_TYPOGRAPHY.cardTitle}`}>
                {title}
              </h3>
              <p className={`mt-2 leading-relaxed text-[var(--fg-muted)] ${LANDING_TYPOGRAPHY.body}`}>
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
          <p className={`mt-5 max-w-lg leading-relaxed text-[var(--fg-secondary)] ${LANDING_TYPOGRAPHY.lead}`}>
            Neonix turns HTML/CSS into semantic, atomic JSON: named layers,
            properties and relationships that can be edited by a person, an
            agent or a template system.
          </p>
          <div className={`mt-7 space-y-3 text-[var(--fg-secondary)] ${LANDING_TYPOGRAPHY.body}`}>
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
            <div className={`mb-4 flex items-center gap-2 font-mono text-[#9FE7E0] ${LANDING_TYPOGRAPHY.codeMeta}`}>
              <Braces className="h-3.5 w-3.5" /> normalized-motion.json
            </div>
            <pre className={`m-0 overflow-auto font-mono leading-7 text-[#D9E7EE] ${LANDING_TYPOGRAPHY.code}`}>
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
        <p className={`mt-5 max-w-2xl leading-relaxed text-[var(--fg-secondary)] ${LANDING_TYPOGRAPHY.lead}`}>
          Connect your agent to a Neonix workspace, let it create or update the
          project, then take over in the editor whenever you want precision.
        </p>
      </Reveal>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        <Reveal>
          <article className="h-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6">
            <Network className="h-5 w-5 text-[var(--accent)]" />
            <h3 className={`mt-5 font-semibold text-[var(--fg-primary)] ${LANDING_TYPOGRAPHY.cardTitle}`}>
              MCP in one click
            </h3>
            <p className={`mt-2 leading-relaxed text-[var(--fg-muted)] ${LANDING_TYPOGRAPHY.body}`}>
              Connect Claude, ChatGPT or Grok directly to a Neonix
              workspace without a local render setup.
            </p>
          </article>
        </Reveal>
        <Reveal delay={70}>
          <article className="h-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6">
            <Sparkles className="h-5 w-5 text-[var(--accent)]" />
            <h3 className={`mt-5 font-semibold text-[var(--fg-primary)] ${LANDING_TYPOGRAPHY.cardTitle}`}>
              Create, update, refine
            </h3>
            <p className={`mt-2 leading-relaxed text-[var(--fg-muted)] ${LANDING_TYPOGRAPHY.body}`}>
              Agents can create a project and update specific layers instead of
              replacing the whole render.
            </p>
          </article>
        </Reveal>
        <Reveal delay={140}>
          <article className="h-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6">
            <ScanSearch className="h-5 w-5 text-[var(--accent)]" />
            <h3 className={`mt-5 font-semibold text-[var(--fg-primary)] ${LANDING_TYPOGRAPHY.cardTitle}`}>
              Hand off to humans
            </h3>
            <p className={`mt-2 leading-relaxed text-[var(--fg-muted)] ${LANDING_TYPOGRAPHY.body}`}>
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
        <p className={`mt-5 max-w-2xl leading-relaxed text-[var(--fg-secondary)] ${LANDING_TYPOGRAPHY.lead}`}>
          Remotion is a powerful code-first framework for rendering video with
          React. Neonix is an agent-first motion workspace for turning web
          primitives into editable projects.
        </p>
      </Reveal>
      <Reveal delay={90}>
        <div className="mt-10 overflow-x-auto rounded-xl border border-[var(--border-strong)]">
          <table className={`w-full min-w-[680px] border-collapse text-left ${LANDING_TYPOGRAPHY.body}`}>
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
        <p className={`mx-auto mt-5 max-w-xl leading-relaxed text-[var(--fg-secondary)] ${LANDING_TYPOGRAPHY.lead}`}>
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

function LandingFooter() {
  return (
    <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-site)]">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/" className="text-sm font-semibold tracking-[0.08em] text-[var(--fg-primary)]">
            NEONIX
          </Link>
          <p className="mt-2 text-sm text-[var(--fg-muted)]">
            HTML and CSS authoring for structured motion video.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--fg-secondary)]">
          <Link className="transition-colors hover:text-[var(--fg-primary)]" href="/docs">
            Docs
          </Link>
          <Link className="transition-colors hover:text-[var(--fg-primary)]" href="/support">
            Support
          </Link>
          <Link className="transition-colors hover:text-[var(--fg-primary)]" href="/privacy">
            Privacy
          </Link>
          <Link className="transition-colors hover:text-[var(--fg-primary)]" href="/terms">
            Terms
          </Link>
          <a className="transition-colors hover:text-[var(--fg-primary)]" href="mailto:support@neonix.video">
            Contact
          </a>
        </nav>
      </div>
      <div className="border-t border-[var(--border-subtle)] px-6 py-4 text-center text-xs text-[var(--fg-muted)]">
        © {new Date().getFullYear()} Neonix. All rights reserved.
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <>
      <main className="bg-[var(--bg-site)] text-[var(--fg-primary)]">
        <Hero />
        <Workflow />
        <Capabilities />
        <StructuredMotion />
        <AgentWorkflow />
        <Comparison />
        <FinalCta />
      </main>
      <LandingFooter />
    </>
  );
}
