export function DocsToc({
  items,
}: {
  items: Array<{ id: string; title: string }>;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-[var(--fg-muted)] uppercase">
        On this page
      </p>
      <ul className="flex flex-col gap-1 text-[13px]">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="text-[var(--fg-muted)] no-underline hover:text-[var(--fg-primary)]"
            >
              {item.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
