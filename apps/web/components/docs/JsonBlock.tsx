export function JsonBlock({
  code,
  caption,
}: {
  code: string;
  caption?: string;
}) {
  return (
    <figure className="my-4">
      {caption ? (
        <figcaption className="mb-2 text-[12px] text-[var(--fg-muted)]">
          {caption}
        </figcaption>
      ) : null}
      <pre className="overflow-x-auto rounded-xl bg-[var(--code-block-bg)] p-4 text-[12.5px] leading-relaxed text-[var(--code-block-fg)]">
        <code>{code}</code>
      </pre>
    </figure>
  );
}
