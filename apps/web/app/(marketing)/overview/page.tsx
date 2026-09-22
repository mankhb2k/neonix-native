import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Overview",
  description:
    "Neonix is an HTML-to-motion-video compiler: it turns HTML and CSS into a real, exportable motion video. The canonical, one-page reference for what Neonix is.",
  alternates: { canonical: "/overview" },
};

const SOFTWARE_APPLICATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Neonix",
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Web",
  description:
    "Neonix is an HTML-to-motion-video compiler: it turns HTML and CSS into a real, exportable motion video.",
  url: "https://www.neonix.video/overview",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

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
      "AI agents such as Claude, ChatGPT and Grok connect to Neonix's Remote MCP server and call tools like create_project_html to compile HTML/CSS into a video project, then export it as MP4.",
  },
  {
    question: "What does Neonix compile HTML/CSS into?",
    answer:
      "A structured JSON scene document that stays editable after compilation, in the Neonix editor or programmatically, before the final video render.",
  },
  {
    question: "Do I need to set up my own rendering infrastructure?",
    answer:
      "No. You author HTML/CSS; Neonix's hosted compiler and renderer turn it into a video. There is no self-hosted compiler, GPU worker, or render pipeline to run or maintain.",
  },
  {
    question: "Where can I read the full technical documentation?",
    answer:
      "The complete HTML/CSS authoring reference, the JSON document schema, and MCP tool details live at neonix.video/docs.",
  },
];

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

const PIPELINE = ["HTML", "JSON", "Editor", "Export video"] as const;

export default function OverviewPage() {
  return (
    <main className="min-h-[calc(100vh-72px)] bg-[var(--bg-site)] text-[var(--fg-primary)]">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SOFTWARE_APPLICATION_JSON_LD) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />

      <article className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-text)]">
          Canonical overview
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
          What Neonix is
        </h1>

        <blockquote className="mt-8 border-l-2 border-[var(--accent)] pl-5 text-lg leading-relaxed text-[var(--fg-primary)] sm:text-xl">
          Neonix is an HTML-to-motion-video compiler: it turns HTML and CSS
          into a real, exportable motion video.
        </blockquote>

        <p className="mt-6 leading-7 text-[var(--fg-secondary)]">
          You, or an AI agent such as Claude, ChatGPT or Grok connected over
          Remote MCP, write HTML and CSS describing a scene. Neonix compiles
          it deterministically and renders it into a real MP4. It is not a
          template-filling tool, and it is not a prompt-only video generator
          you can&apos;t control.
        </p>

        <section className="mt-12">
          <h2 className="text-xl font-semibold text-[var(--fg-primary)]">How it works</h2>
          <div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-sm text-[var(--fg-secondary)]">
            {PIPELINE.map((step, index) => (
              <span key={step} className="flex items-center gap-2">
                <span className="rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 py-1.5 text-[var(--fg-primary)]">
                  {step}
                </span>
                {index < PIPELINE.length - 1 ? (
                  <span aria-hidden="true" className="text-[var(--fg-muted)]">
                    →
                  </span>
                ) : null}
              </span>
            ))}
          </div>
          <p className="mt-4 leading-7 text-[var(--fg-secondary)]">
            Author HTML and CSS, Neonix compiles it into a structured JSON
            scene document, preview and refine it in the Neonix editor, then
            export a real MP4.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold text-[var(--fg-primary)]">FAQ</h2>
          <dl className="mt-4 space-y-6">
            {FAQ_ITEMS.map((item) => (
              <div key={item.question}>
                <dt className="font-semibold text-[var(--fg-primary)]">{item.question}</dt>
                <dd className="mt-1 leading-7 text-[var(--fg-secondary)]">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold text-[var(--fg-primary)]">Learn more</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-[var(--fg-secondary)]">
            <li>
              <Link className="underline hover:text-[var(--fg-primary)]" href="/html-to-video">
                Full HTML-to-motion-video walkthrough
              </Link>
            </li>
            <li>
              <Link className="underline hover:text-[var(--fg-primary)]" href="/docs">
                Technical documentation
              </Link>
            </li>
            <li>
              <Link className="underline hover:text-[var(--fg-primary)]" href="/docs/mcp">
                Connect an AI agent over Remote MCP
              </Link>
            </li>
            <li>
              <Link className="underline hover:text-[var(--fg-primary)]" href="/playground">
                Try the interactive playground
              </Link>
            </li>
            <li>
              <a
                className="underline hover:text-[var(--fg-primary)]"
                href="https://github.com/neonix-video/html-to-video"
              >
                create-neonix on GitHub
              </a>
            </li>
          </ul>
        </section>
      </article>
    </main>
  );
}
