import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support",
  description: "Get help with Neonix projects, HTML/CSS compilation, MCP, and video export.",
  alternates: { canonical: "/support" },
};

const supportTopics = [
  "HTML/CSS authoring and supported tags or CSS values",
  "HTML to Neonix JSON V2 compilation diagnostics",
  "MCP connection, authentication, and project tools",
  "Media assets, previews, and video export jobs",
];

export default function SupportPage() {
  return (
    <main className="min-h-[calc(100vh-72px)] bg-[var(--bg-site)] text-[var(--fg-primary)]">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-text)]">
          Neonix support
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
          Help with your motion project
        </h1>
        <p className="mt-5 text-lg leading-8 text-[var(--fg-secondary)]">
          Neonix turns HTML and CSS authoring into structured motion projects.
          Contact us when you need help creating, compiling, previewing, or
          exporting a project.
        </p>

        <section className="mt-12 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-6 sm:p-8">
          <h2 className="text-xl font-semibold">Contact support</h2>
          <p className="mt-3 leading-7 text-[var(--fg-secondary)]">
            Email us at{" "}
            <a
              className="text-[var(--accent-text)] underline underline-offset-4"
              href="mailto:support@neonix.video"
            >
              support@neonix.video
            </a>
            . Include the project ID, the endpoint or workflow involved, and
            any relevant error message. Please do not include passwords,
            access tokens, or other secrets.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold">What we can help with</h2>
          <ul className="mt-5 space-y-3 text-[var(--fg-secondary)]">
            {supportTopics.map((topic) => (
              <li key={topic} className="flex gap-3 leading-7">
                <span className="text-[var(--accent-text)]" aria-hidden="true">
                  →
                </span>
                <span>{topic}</span>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-14 border-t border-[var(--border-subtle)] pt-6 text-sm leading-6 text-[var(--fg-muted)]">
          For information about how Neonix handles data, read our{" "}
          <Link className="underline underline-offset-4" href="/privacy">
            Privacy Policy
          </Link>
          . For service terms, read our{" "}
          <Link className="underline underline-offset-4" href="/terms">
            Terms of Service
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
