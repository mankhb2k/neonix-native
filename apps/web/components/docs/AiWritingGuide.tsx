export function AiWritingGuide({ items }: { items: string[] }) {
  return (
    <section id="ai-guide" className="my-8">
      <h2 className="mb-3 text-xl font-semibold tracking-tight">
        AI writing guide
      </h2>
      <div className="rounded-xl border border-[var(--callout-border,var(--border-subtle))] bg-[var(--callout-bg,var(--bg-elevated))] p-4 text-[14px]">
        <p className="mb-2 font-medium text-[var(--accent-text)]">
          When generating JSON, prefer:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-[var(--fg-secondary)]">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
