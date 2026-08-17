"use client";

import { useMemo, useState } from "react";
import { DocsPixiPreview } from "@/components/docs/DocsPixiPreview";
import { TimelineStrip, lanesFromProject } from "@/components/docs/TimelineStrip";
import { JsonBlock } from "@/components/docs/JsonBlock";
import { attemptParse } from "@/lib/docs/parse-result";

export type GalleryItem = {
  id: string;
  label: string;
  project: unknown;
  kind: "valid" | "invalid";
};

export function ExamplesGallery({ items }: { items: GalleryItem[] }) {
  const [id, setId] = useState(items[0]?.id ?? "");
  const selected = items.find((item) => item.id === id) ?? items[0];
  const strip = useMemo(
    () => (selected ? lanesFromProject(selected.project as never) : null),
    [selected],
  );
  const parsed = selected ? attemptParse(selected.project) : null;

  if (!selected) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setId(item.id)}
            className={`rounded-full border px-3 py-1 text-[13px] ${
              item.id === selected.id
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]"
                : "border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {parsed ? (
        <p className={`text-[13px] ${parsed.ok ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
          {parsed.message}
        </p>
      ) : null}
      {selected.kind === "valid" ? (
        <DocsPixiPreview project={selected.project} play />
      ) : (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-[13px] text-red-800">
          Invalid fixtures are not previewed. Schema and compile decide
          correctness.
        </p>
      )}
      {strip ? <TimelineStrip lanes={strip.lanes} duration={strip.duration} /> : null}
      <JsonBlock code={JSON.stringify(selected.project, null, 2)} />
    </div>
  );
}
