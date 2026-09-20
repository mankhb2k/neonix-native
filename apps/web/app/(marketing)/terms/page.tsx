import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Neonix",
  description: "The terms that apply when you use Neonix.",
  alternates: { canonical: "/terms" },
};

const updated = "September 9, 2026";

export default function TermsPage() {
  return (
    <main className="min-h-[calc(100vh-72px)] bg-[var(--bg-site)] text-[var(--fg-primary)]">
      <article className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-text)]">
          Neonix legal
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
          Terms of Service
        </h1>
        <p className="mt-4 text-sm text-[var(--fg-muted)]">Last updated: {updated}</p>

        <div className="mt-10 space-y-10 leading-7 text-[var(--fg-secondary)]">
          <section>
            <h2 className="text-xl font-semibold text-[var(--fg-primary)]">Using Neonix</h2>
            <p className="mt-3">
              By using Neonix, its hosted API, or its MCP server, you agree to
              use the service lawfully and in accordance with these terms. You
              are responsible for keeping your account credentials secure and
              for activity performed through your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--fg-primary)]">Your projects and content</h2>
            <p className="mt-3">
              You retain your rights to the HTML, CSS, JSON, text, media, and
              other content you provide to Neonix. You grant Neonix permission
              to host, process, compile, render, and transmit that content only
              as needed to provide the requested features. You must have the
              rights and permissions needed for content and assets you upload.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--fg-primary)]">Acceptable use</h2>
            <p className="mt-3">
              Do not use Neonix to violate law or third-party rights, upload
              malicious code or content, bypass authentication or usage limits,
              interfere with the service, or attempt to access another user’s
              projects or assets.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--fg-primary)]">Previews and exports</h2>
            <p className="mt-3">
              Compilation, preview, rendering, and export results depend on
              the supported HTML/CSS subset, available infrastructure, and the
              content of your project. You should review generated output before
              publishing or relying on it. Neonix does not guarantee that every
              browser feature, CSS value, external resource, or animation will
              be supported.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--fg-primary)]">Availability and changes</h2>
            <p className="mt-3">
              Neonix may change, suspend, or discontinue features, including
              preview and export capabilities, to maintain or improve the
              service. We may suspend access when reasonably necessary to
              protect the service, users, or third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--fg-primary)]">Disclaimer and liability</h2>
            <p className="mt-3">
              Neonix is provided on an as-available basis to the extent
              permitted by law. To the extent permitted by law, Neonix is not
              responsible for indirect, incidental, or consequential losses
              resulting from your use of the service. Nothing in these terms
              limits rights or liabilities that cannot legally be limited.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--fg-primary)]">Contact</h2>
            <p className="mt-3">
              Questions about these terms can be sent to{" "}
              <a
                className="text-[var(--accent-text)] underline underline-offset-4"
                href="mailto:support@neonix.video"
              >
                support@neonix.video
              </a>
              .
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
