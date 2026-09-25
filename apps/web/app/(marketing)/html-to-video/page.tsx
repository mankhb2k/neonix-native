import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HTML to Motion Video",
  description:
    "Neonix is an HTML-to-motion-video compiler, built for AI agents like Claude, ChatGPT and Grok over Remote MCP.",
  alternates: { canonical: "/html-to-video" },
};

const PIPELINE_STEPS = [
  {
    number: "01",
    title: "Write HTML & CSS",
    description:
      "Describe a scene with familiar markup, layout, paint and typography — no new authoring language.",
  },
  {
    number: "02",
    title: "Compile to Protocol V2",
    description:
      "Neonix validates the source and compiles it into Neonix Protocol V2, a canonical, semantic motion-video document (JSON).",
  },
  {
    number: "03",
    title: "Preview & edit",
    description:
      "Open the project in the Neonix editor to inspect, refine, or hand it back to an agent for another pass.",
  },
  {
    number: "04",
    title: "Export MP4",
    description:
      "Render the project through Neonix's native export pipeline into a real, downloadable motion video.",
  },
] as const;

const COMPARISON_ROWS = [
  {
    aspect: "Input",
    templateTool: "A prompt or a fixed template with a few swappable fields",
    neonix: "Arbitrary HTML and CSS you write or an agent generates",
  },
  {
    aspect: "Output",
    templateTool: "A flattened render matching a preset look",
    neonix: "A structured, editable Protocol V2 document, then a real MP4",
  },
  {
    aspect: "Editing after generation",
    templateTool: "Limited to the template's exposed fields",
    neonix: "Every layer and property stays independently editable",
  },
  {
    aspect: "AI agent access",
    templateTool: "Usually none, or a closed prompt-only API",
    neonix: "Native Remote MCP tools for Claude, ChatGPT and Grok",
  },
] as const;

type ComparisonRow = { aspect: string; remotion: string; neonix: string };

const REMOTION_COMPARISON_ROWS: readonly ComparisonRow[] = [
  {
    aspect: "Rendering",
    remotion:
      "Headless Chrome takes a screenshot of every frame, then ffmpeg stitches them together — color and fonts can shift between your dev machine and the Linux render server",
    neonix:
      "A native CPU/GPU pipeline with an explicit color space — the same document renders identically on every platform",
  },
  {
    aspect: "Rendering speed",
    remotion:
      "Community benchmarks report full renders taking 2–4x the video's own length even on 8 vCPU, with CPU utilization that doesn't scale reliably as more cores are added",
    neonix:
      "A 1920×1080, 60-second video exports in 14 seconds on 4 vCPU / 16GB RAM in Neonix's own benchmark",
  },
  {
    aspect: "Authoring",
    remotion: "React components — requires writing code",
    neonix:
      "Plain HTML/CSS, compiled into an editable Neonix JSON V2 document, with a visual editor for people who don't write code",
  },
  {
    aspect: "AI agent integration",
    remotion:
      "Remotion's own MCP server is deprecated; the community MCP app still has the AI write React/JSX code and compile it, not plain markup",
    neonix:
      "MCP tools accept HTML and CSS directly — the AI agent never writes React, JSX, or rendering code",
  },
  {
    aspect: "Export",
    remotion:
      "No built-in rendering service — you deploy and manage your own AWS Lambda or GCP Cloud Run",
    neonix:
      "Renders through Neonix's own hosted cloud API from inside the same editor, billed per second of video — no separate deployment to manage",
  },
];

const REMOTION_SOURCES: readonly { label: string; href: string }[] = [
  {
    label: "Remotion is too slow to use in production — GitHub issue #4783",
    href: "https://github.com/remotion-dev/remotion/issues/4783",
  },
  {
    label: "Renderer not utilizing CPU cores even with concurrency 100% — GitHub issue #4300",
    href: "https://github.com/remotion-dev/remotion/issues/4300",
  },
  {
    label: "Remotion's Model Context Protocol (deprecated) — Remotion docs",
    href: "https://www.remotion.dev/docs/ai/mcp",
  },
];

type HyperFramesComparisonRow = { aspect: string; hyperframes: string; neonix: string };

const HYPERFRAMES_COMPARISON_ROWS: readonly HyperFramesComparisonRow[] = [
  {
    aspect: "Rendering",
    hyperframes:
      "Headless Chrome captures a screenshot of every frame, then FFmpeg encodes it — the same browser-based mechanism as most code-first video tools",
    neonix:
      "A native CPU/GPU pipeline with an explicit color space — the same document renders identically on every platform",
  },
  {
    aspect: "Editing after generation",
    hyperframes:
      "Editing means rewriting the HTML/CSS/JS source and re-rendering — no visual editor for people who don't write code",
    neonix:
      "Compiles into a structured Neonix JSON V2 document with layers, groups and timing, plus a visual editor for people who don't write code",
  },
  {
    aspect: "Export",
    hyperframes:
      "Renders through HeyGen's cloud API, billed per minute ($0.10–$0.30/min depending on resolution and frame rate), or self-hosted via your own Vercel, Cloudflare, Modal or Lambda deployment",
    neonix:
      "Renders through Neonix's own hosted cloud API from inside the same editor, billed per second of video — no separate deployment to manage",
  },
];

type FaqItem = { question: string; answer: string };

const FAQ_ITEMS: readonly FaqItem[] = [
  {
    question: "What is Neonix?",
    answer:
      "Neonix is an HTML-to-motion-video compiler that turns HTML and CSS into a real, exportable video.",
  },
  {
    question: "How do AI agents use Neonix?",
    answer:
      "AI agents such as Claude connect to Neonix's Remote MCP server and call tools like create_project_html to compile HTML/CSS into a video project, then export it as MP4.",
  },
  {
    question: "What makes Neonix different from template-based AI video tools?",
    answer:
      "Neonix compiles arbitrary HTML/CSS into a canonical protocol document and renders it deterministically — it does not fill in a fixed template.",
  },
  {
    question: "Can Neonix convert HTML/CSS to MP4?",
    answer:
      "Yes. Neonix compiles HTML/CSS into Neonix Protocol V2, then exports MP4 through its native render pipeline.",
  },
  {
    question: "How does Neonix's pipeline work?",
    answer:
      "Neonix compiles HTML/CSS into Neonix Protocol V2 (JSON), which you can preview and edit in the Neonix editor, then export to a real MP4.",
  },
  {
    question: "How is Neonix different from Remotion?",
    answer:
      "Remotion renders video by taking headless Chrome screenshots frame-by-frame and stitching them with ffmpeg, which means writing React components and managing your own AWS Lambda or Cloud Run deployment to render at scale — and community benchmarks report full renders taking 2-4x the video's own length even on 8 vCPU. Neonix compiles plain HTML/CSS into an editable Neonix JSON V2 document and renders it through a native CPU/GPU pipeline with an explicit color space, exporting a 1920x1080, 60-second video in 14 seconds on 4 vCPU / 16GB RAM in Neonix's own benchmark — through a hosted cloud pipeline in one click, no code and no infrastructure required.",
  },
  {
    question: "Does Remotion work with AI agents the same way Neonix does?",
    answer:
      "Not the same way. Remotion's own MCP server is deprecated, and even the community MCP app for Remotion still has the AI agent write React/JSX code and compile it. Neonix's MCP tools — create_project_html and update_project_html — accept plain HTML and CSS directly, so an AI agent like Claude never writes React, JSX, or rendering code.",
  },
];

const CODE_EXAMPLE = `<div class="card">
  <h1>Make it move.</h1>
  <p class="subtitle">Turn an idea into motion.</p>
</div>

<style>
  .card { animation: pulse 2s ease-in-out infinite; }
  .subtitle { color: #0f766e; }
</style>`;

const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

const HOW_TO_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How Neonix turns HTML into a motion video",
  description:
    "From markup to a real, exportable video: write HTML and CSS, compile it to Neonix Protocol V2, preview and edit, then export MP4.",
  step: PIPELINE_STEPS.map((step) => ({
    "@type": "HowToStep",
    position: Number(step.number),
    name: step.title,
    text: step.description,
  })),
};

function SectionEyebrow({ children }: { children: string }) {
  return (
    <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-text)]">
      {children}
    </p>
  );
}

export default function HtmlToVideoPage() {
  return (
    <main className="bg-[var(--bg-site)] text-[var(--fg-primary)]">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(HOW_TO_JSON_LD) }}
      />

      {/* Hero */}
      <section className="border-b border-[var(--border-subtle)] px-6 pb-16 pt-24 text-center sm:pt-32">
        <div className="mx-auto max-w-[1200px]">
          <SectionEyebrow>HTML-to-motion-video compiler</SectionEyebrow>
          <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-semibold leading-[1.05] tracking-[-0.03em] sm:text-6xl">
            HTML to Motion Video.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[var(--fg-secondary)]">
            Neonix is an HTML-to-motion-video compiler, built for AI agents
            like Claude, ChatGPT and Grok over Remote MCP.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/playground"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-transparent bg-[var(--accent)] px-4 text-base font-semibold text-[var(--accent-on)] shadow-sm no-underline transition hover:bg-[var(--accent-hover)]"
            >
              Convert HTML to video
            </Link>
            <Link
              href="/docs/mcp"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-4 text-base font-semibold text-[var(--fg-primary)] no-underline transition hover:border-[var(--accent)]"
            >
              Connect via MCP
            </Link>
          </div>
        </div>
      </section>

      {/* Definition */}
      <section className="mx-auto max-w-[1200px] px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-8 sm:p-10">
            <p className="border-l-2 border-[var(--accent)] pl-5 text-lg leading-relaxed text-[var(--fg-primary)] sm:text-xl">
              Neonix is an HTML-to-motion-video compiler. Users — or AI agents
              like Claude, connected over Remote MCP — write HTML and CSS
              describing a scene. Neonix validates and compiles it into a
              canonical motion-video document, then renders it to a real,
              exportable MP4. It is not a template generator or a
              prompt-only video tool.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-[1200px]">
          <SectionEyebrow>How it works</SectionEyebrow>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
            From markup to a real, exportable video.
          </h2>
          <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--border-subtle)] sm:grid-cols-2 lg:grid-cols-4">
            {PIPELINE_STEPS.map((step) => (
              <div key={step.number} className="h-full bg-[var(--bg-elevated)] p-6">
                <span className="font-mono text-sm text-[var(--accent-text)]">
                  {step.number}
                </span>
                <h3 className="mt-6 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)]">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-[900px]">
          <SectionEyebrow>Why it's different</SectionEyebrow>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
            A compiler, not a template filler.
          </h2>
          <div className="mt-10 overflow-hidden rounded-xl border border-[var(--border-strong)]">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-[var(--bg-surface)]">
                  <th className="p-4 font-semibold text-[var(--fg-muted)]">
                    &nbsp;
                  </th>
                  <th className="p-4 font-semibold text-[var(--fg-secondary)]">
                    Template-based AI video tools
                  </th>
                  <th className="p-4 font-semibold text-[var(--accent-text)]">
                    Neonix
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, index) => (
                  <tr
                    key={row.aspect}
                    className={
                      index % 2 === 0
                        ? "bg-[var(--bg-elevated)]"
                        : "bg-[var(--bg-site)]"
                    }
                  >
                    <td className="border-t border-[var(--border-subtle)] p-4 font-semibold text-[var(--fg-primary)]">
                      {row.aspect}
                    </td>
                    <td className="border-t border-[var(--border-subtle)] p-4 font-medium text-[var(--fg-secondary)]">
                      {row.templateTool}
                    </td>
                    <td className="border-t border-[var(--border-subtle)] p-4 font-medium text-[var(--fg-primary)]">
                      {row.neonix}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Comparison: Remotion */}
      <section className="border-y border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-[900px]">
          <SectionEyebrow>Neonix vs Remotion</SectionEyebrow>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
            A compiled pipeline, not a headless browser.
          </h2>
          <p className="mt-4 max-w-2xl text-[var(--fg-secondary)]">
            Remotion is a code-first framework for rendering video with React.
            Neonix compiles HTML/CSS directly into an editable document and
            exports it through a native, hosted render pipeline — a
            1920×1080, 60-second video exports in 14 seconds on 4 vCPU / 16GB
            RAM in Neonix's own benchmark.
          </p>
          <div className="mt-10 overflow-hidden rounded-xl border border-[var(--border-strong)]">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-[var(--bg-elevated)]">
                  <th className="p-4 font-semibold text-[var(--fg-muted)]">
                    &nbsp;
                  </th>
                  <th className="p-4 font-semibold text-[var(--fg-secondary)]">
                    Remotion
                  </th>
                  <th className="p-4 font-semibold text-[var(--accent-text)]">
                    Neonix
                  </th>
                </tr>
              </thead>
              <tbody>
                {REMOTION_COMPARISON_ROWS.map((row, index) => (
                  <tr
                    key={row.aspect}
                    className={
                      index % 2 === 0
                        ? "bg-[var(--bg-site)]"
                        : "bg-[var(--bg-elevated)]"
                    }
                  >
                    <td className="border-t border-[var(--border-subtle)] p-4 font-semibold text-[var(--fg-primary)]">
                      {row.aspect}
                    </td>
                    <td className="border-t border-[var(--border-subtle)] p-4 font-medium text-[var(--fg-secondary)]">
                      {row.remotion}
                    </td>
                    <td className="border-t border-[var(--border-subtle)] p-4 font-medium text-[var(--fg-primary)]">
                      {row.neonix}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-4 space-y-1 text-xs text-[var(--fg-muted)]">
            {REMOTION_SOURCES.map((source) => (
              <li key={source.href}>
                <a
                  href={source.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-[var(--fg-secondary)]"
                >
                  {source.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Comparison: HyperFrames */}
      <section className="px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-[900px]">
          <SectionEyebrow>Neonix vs HyperFrames</SectionEyebrow>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
            Same HTML-first idea, different editing model.
          </h2>
          <p className="mt-4 max-w-2xl text-[var(--fg-secondary)]">
            HyperFrames is HeyGen's open-source HTML-to-video renderer for AI
            agents — the closest idea to Neonix's own approach. Neonix
            compiles HTML/CSS into a structured, editable document with a
            visual editor, and renders it natively from inside the same
            workspace.
          </p>
          <div className="mt-10 overflow-hidden rounded-xl border border-[var(--border-strong)]">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-[var(--bg-surface)]">
                  <th className="p-4 font-semibold text-[var(--fg-muted)]">
                    &nbsp;
                  </th>
                  <th className="p-4 font-semibold text-[var(--fg-secondary)]">
                    HyperFrames
                  </th>
                  <th className="p-4 font-semibold text-[var(--accent-text)]">
                    Neonix
                  </th>
                </tr>
              </thead>
              <tbody>
                {HYPERFRAMES_COMPARISON_ROWS.map((row, index) => (
                  <tr
                    key={row.aspect}
                    className={
                      index % 2 === 0
                        ? "bg-[var(--bg-elevated)]"
                        : "bg-[var(--bg-site)]"
                    }
                  >
                    <td className="border-t border-[var(--border-subtle)] p-4 font-semibold text-[var(--fg-primary)]">
                      {row.aspect}
                    </td>
                    <td className="border-t border-[var(--border-subtle)] p-4 font-medium text-[var(--fg-secondary)]">
                      {row.hyperframes}
                    </td>
                    <td className="border-t border-[var(--border-subtle)] p-4 font-medium text-[var(--fg-primary)]">
                      {row.neonix}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Code example */}
      <section className="border-y border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-[1200px]">
          <div className="mx-auto max-w-3xl">
            <SectionEyebrow>See it in practice</SectionEyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
              This is a complete Neonix input.
            </h2>
            <p className="mt-4 max-w-xl text-[var(--fg-secondary)]">
              Neonix compiles markup like this into named, independently
              editable layers — not a flattened frame.
            </p>
            <pre className="mt-8 overflow-x-auto rounded-xl border border-[var(--border-strong)] bg-[var(--code-block-bg)] p-6 font-mono text-sm leading-6 text-[var(--code-block-fg)]">
              {CODE_EXAMPLE}
            </pre>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-[1200px]">
          <div className="mx-auto max-w-[900px]">
            <SectionEyebrow>FAQ</SectionEyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
              Frequently asked questions.
            </h2>
            <div className="mt-8 divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
              {FAQ_ITEMS.map((item) => (
                <details key={item.question} className="group py-5">
                  <summary className="cursor-pointer list-none text-lg font-semibold text-[var(--fg-primary)] marker:content-none">
                    {item.question}
                  </summary>
                  <p className="mt-3 leading-relaxed text-[var(--fg-secondary)]">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[var(--border-subtle)] px-6 py-16 text-center sm:py-20">
        <div className="mx-auto max-w-[1200px]">
          <h2 className="mx-auto max-w-xl text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
            Connect your agent and try it.
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/docs/mcp/claude"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-4 text-base font-semibold text-[var(--fg-primary)] no-underline transition hover:border-[var(--accent)]"
            >
              Claude
            </Link>
            <Link
              href="/docs/mcp/chatgpt"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-4 text-base font-semibold text-[var(--fg-primary)] no-underline transition hover:border-[var(--accent)]"
            >
              ChatGPT
            </Link>
            <Link
              href="/docs/mcp/grok"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-4 text-base font-semibold text-[var(--fg-primary)] no-underline transition hover:border-[var(--accent)]"
            >
              Grok
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
