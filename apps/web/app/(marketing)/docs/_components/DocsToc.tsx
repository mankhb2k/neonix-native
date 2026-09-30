"use client";

import { useEffect, useState } from "react";

export function DocsToc({
  items,
}: {
  items: Array<{ id: string; title: string }>;
}) {
  const [active, setActive] = useState(items[0]?.id ?? "");

  useEffect(() => {
    if (items.length === 0) return undefined;
    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el != null);
    if (headings.length === 0) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          );
        if (visible[0]?.target.id) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: [0, 1] },
    );
    for (const heading of headings) observer.observe(heading);
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-sm font-semibold tracking-[0.12em] text-[var(--fg-muted)] uppercase">
        On this page
      </p>
      <ul className="flex flex-col gap-1 text-sm leading-5">
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={
                  isActive
                    ? "font-medium text-[#0d9488] no-underline"
                    : "text-[var(--fg-muted)] no-underline hover:text-[var(--fg-primary)]"
                }
              >
                {item.title}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
