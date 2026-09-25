import { GuideCard } from "@/components/guides/GuideCard";
import { listGuides } from "@/lib/guides/guides";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Guides",
  description: "Practical, step-by-step guides for creating a real, exportable motion video with Neonix and AI agents like Claude.",
  alternates: { canonical: "/guides" },
};

export default function GuidesIndexPage() {
  const guides = listGuides();
  return (
    <main className="min-h-[calc(100vh-72px)] bg-[var(--bg-site)] text-[var(--fg-primary)]">
      <div className="mx-auto max-w-[900px] px-6 py-16 sm:py-24">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-text)]">Guides</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
          Create motion video, step by step
        </h1>
        <p className="mt-4 max-w-2xl leading-7 text-[var(--fg-secondary)]">
          Task-focused guides for turning an idea into a real, exportable video with
          Neonix — from an AI agent prompt to a finished MP4.
        </p>

        {guides.length > 0 ? (
          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {guides.map((guide) => (
              <GuideCard key={guide.slug} guide={guide} />
            ))}
          </div>
        ) : (
          <p className="mt-12 text-[var(--fg-muted)]">More guides are on the way.</p>
        )}
      </div>
    </main>
  );
}
