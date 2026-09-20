import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HTML to Motion Video — Neonix",
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

const FAQ_ITEMS = [
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
] as const;

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

      {/* Hero */}
      <section className="border-b border-[var(--border-subtle)] px-6 pb-16 pt-24 text-center sm:pt-32">
        <div className="mx-auto max-w-3xl">
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
              Try the compiler
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
      <section className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
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
      </section>

      {/* How it works */}
      <section className="border-y border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl">
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
        <div className="mx-auto max-w-4xl">
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
                    <td className="border-t border-[var(--border-subtle)] p-4 text-[var(--fg-muted)]">
                      {row.templateTool}
                    </td>
                    <td className="border-t border-[var(--border-subtle)] p-4 text-[var(--fg-primary)]">
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
      </section>

      {/* FAQ */}
      <section className="px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl">
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
      </section>

      {/* CTA */}
      <section className="border-t border-[var(--border-subtle)] px-6 py-16 text-center sm:py-20">
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
      </section>
    </main>
  );
}
