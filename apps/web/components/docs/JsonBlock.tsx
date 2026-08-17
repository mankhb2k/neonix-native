"use client";

import { useState } from "react";

export function JsonBlock({
  code,
  caption,
  maxLines,
}: {
  code: string;
  caption?: string;
  maxLines?: number;
}) {
  const [open, setOpen] = useState(false);
  const lines = code.split("\n");
  const collapsible = maxLines != null && lines.length > maxLines;

  return (
    <figure className="my-4">
      {caption ? (
        <figcaption className="mb-2 text-[12px] text-[var(--fg-muted)]">
          {caption}
        </figcaption>
      ) : null}
      <pre
        className={`overflow-x-auto rounded-xl bg-[var(--code-block-bg)] p-4 text-[12.5px] leading-relaxed text-[var(--code-block-fg)] ${
          collapsible && !open ? "max-h-[16.5rem] overflow-y-hidden" : ""
        }`}
      >
        <code>{code}</code>
      </pre>
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="mt-2 text-[12px] font-medium text-[var(--accent-text)]"
        >
          {open ? "Show less" : "Show more"}
        </button>
      ) : null}
    </figure>
  );
}
