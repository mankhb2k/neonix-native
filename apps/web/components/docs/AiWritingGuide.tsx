export function AiWritingGuide({ items }: { items: string[] }) {
  return (
    <section id="ai-guide" className="my-8">
      <h2 className="mb-3 text-xl font-semibold tracking-tight">
        AI writing guide
      </h2>
      <div className="rounded-xl border border-[var(--border-subtle,#e4e4e7)] bg-[#f8fafc] p-4 text-[14px]">
        <p className="mb-2 font-medium">When generating JSON, prefer:</p>
        <ul className="list-disc space-y-1 pl-5 text-[var(--fg-primary)]">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
