import { AppLink } from "@/components/AppLink";

/**
 * The legacy authoring editor is frozen until its document model is Protocol
 * V2. The certified editor surface is `/docs/preview`.
 */
export default function DisabledEditorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg-site)] p-6 text-[var(--fg-primary)]">
      <section className="max-w-lg border border-[var(--border-subtle)] bg-[var(--bg-editor)] p-8">
        <h1 className="m-0 text-xl font-semibold">Protocol V2 editor</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--fg-muted)]">
          The legacy authoring surface is paused while the V2 atom protocol is
          certified.
        </p>
        <AppLink
          href="/docs/preview"
          className="mt-6 inline-flex items-center border border-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-text)] no-underline"
        >
          Open V2 preview
        </AppLink>
      </section>
    </main>
  );
}
