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
        <p className="mt-2 font-mono text-[13px] text-[var(--accent-text,#0f766e)]">
          JSON path: {jsonPath}
        </p>
      ) : null}
    </header>
  );
}
