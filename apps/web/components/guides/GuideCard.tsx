import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { GuideSummary } from "@/lib/guides/guides";

export function GuideCard({ guide }: { guide: GuideSummary }) {
  return (
    <Link
      href={`/guides/${guide.slug}`}
      className="group flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-site)] p-6 no-underline shadow-[0_8px_20px_rgba(16,24,40,0.05)] transition hover:border-[var(--accent)] hover:shadow-[0_18px_40px_rgba(15,23,42,0.1)]"
    >
      <h3 className="text-lg font-semibold text-[var(--fg-primary)]">{guide.title}</h3>
      <p className="mt-2 flex-1 text-sm leading-6 text-[var(--fg-secondary)]">{guide.summary}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent-text)]">
        Read guide
        <ArrowUpRight className="size-3.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </span>
    </Link>
  );
}
