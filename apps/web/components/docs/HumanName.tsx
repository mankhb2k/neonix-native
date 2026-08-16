export function HumanName({
  title,
  jsonPath,
  human,
}: {
  title: string;
  jsonPath?: string;
  human?: string;
}) {
  return (
    <header className="mb-6">
      <h1 className="text-3xl font-semibold tracking-tight text-[var(--fg-primary)]">
        {title}
      </h1>
      {human ? (
        <p className="mt-2 text-[15px] text-[var(--fg-muted)]">{human}</p>
      ) : null}
      {jsonPath ? (
        <p className="mt-3">
          <code className="rounded-md border border-[var(--border-subtle,#e4e4e7)] bg-[#f8fafc] px-2 py-1 font-mono text-[12px] text-[var(--fg-primary)]">
            {jsonPath}
          </code>
        </p>
      ) : null}
    </header>
  );
}
