import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Neonix",
  description: "How Neonix collects, uses, and protects information.",
};

const updated = "September 19, 2026";

export default function PrivacyPage() {
  return (
    <main className="min-h-[calc(100vh-72px)] bg-[var(--bg-site)] text-[var(--fg-primary)]">
      <article className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-text)]">
          Neonix legal
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
          Privacy Policy
        </h1>
        <p className="mt-4 text-sm text-[var(--fg-muted)]">Last updated: {updated}</p>

        <div className="mt-10 space-y-10 leading-7 text-[var(--fg-secondary)]">
          <section>
            <h2 className="text-xl font-semibold text-[var(--fg-primary)]">Overview</h2>
            <p className="mt-3">
              Neonix provides tools for creating motion-video projects from
HTML and CSS, managing structured Neonix JSON V2 project data, and
              previewing or exporting those projects. This policy explains the
              information we process when you use Neonix, the hosted API, or
              the Neonix MCP server.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--fg-primary)]">Information we process</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                Account and authentication information, such as your email,
                profile details, and OAuth session information.
              </li>
              <li>
                Workspace and project information, including project names,
composition settings, HTML authoring documents, Neonix JSON V2
                JSON revisions, and audit or revision metadata.
              </li>
              <li>
                Files you choose to upload, including media assets used by a
                project, together with the metadata needed to process them.
              </li>
              <li>
                Operational information, such as API requests, diagnostics,
                export jobs, and security or abuse-prevention events.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--fg-primary)]">How we use information</h2>
            <p className="mt-3">
              We use this information to authenticate you, provide project and
workspace features, compile HTML into Neonix JSON V2, manage assets,
              render previews and exports, provide support, maintain security,
              and improve the reliability of the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--fg-primary)]">Data processing and storage</h2>
            <p className="mt-3">
              Neonix uses managed service infrastructure to provide
              authentication, databases, file storage, hosting, media
              processing, previews, and exports. Access to information is
              limited to the functions needed to operate the service, protect
              users, and deliver the features you request.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--fg-primary)]">Retention and choices</h2>
            <p className="mt-3">
              Project data and uploaded assets are retained while they are
              needed to provide your workspace and requested workflows. You
              may request account or project data deletion by contacting us;
              deletion may be subject to backup, security, or legal retention
              requirements. You can also stop using the MCP connection or
              revoke its OAuth authorization through your account settings or
              the connected application.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--fg-primary)]">Contact</h2>
            <p className="mt-3">
              Questions, privacy requests, and data concerns can be sent to{" "}
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
