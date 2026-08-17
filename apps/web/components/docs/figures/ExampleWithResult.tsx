"use client";

import { useState, type ReactNode } from "react";

const COLLAPSED_LINES = 10;

/**
 * Result-on-top, code-below block with expand/collapse.
 * The result pane is always fully visible; the JSON is clamped to a few
 * lines with a "Show more / Show less" toggle.
 */
export function ExampleWithResult({
  json,
  result,
  caption,
}: {
  /** Pretty-printed JSON string. */
  json: string;
  /** Rendered-result illustration (SVG, img, …). */
  result: ReactNode;
  caption?: string;
}) {
  const [open, setOpen] = useState(false);
  const lines = json.split("\n");
  const collapsible = lines.length > COLLAPSED_LINES;

  return (
    <div className="my-6 overflow-hidden rounded-xl border border-[var(--border-subtle,#e4e4e7)]">
      <div className="flex items-center justify-center bg-[var(--bg-surface)] p-6">
        {result}
      </div>
      <div className="relative border-t border-[var(--border-subtle,#e4e4e7)] bg-[var(--code-block-bg)]">
        <pre
          className={`overflow-x-auto p-4 text-[12.5px] leading-relaxed text-[var(--code-block-fg)] ${
            collapsible && !open ? "max-h-[15rem] overflow-y-hidden" : ""
          }`}
        >
          <code>{json}</code>
        </pre>
        {collapsible ? (
          <>
            {!open ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[var(--code-block-bg)] via-[var(--code-block-bg)]/80 to-transparent" />
            ) : null}
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 cursor-pointer items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-[12px] font-medium text-white/90 shadow-lg backdrop-blur-md transition hover:bg-white/20"
            >
              {open ? (
                <>
                  Show less
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M2.5 7.5 6 4l3.5 3.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </>
              ) : (
                <>
                  Show more
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M2.5 4.5 6 8l3.5-3.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </>
              )}
            </button>
          </>
        ) : null}
      </div>
      {caption ? (
        <p className="border-t border-[var(--border-subtle,#e4e4e7)] bg-[var(--bg-elevated)] px-4 py-2 text-[12px] text-[var(--fg-muted)]">
          {caption}
        </p>
      ) : null}
    </div>
  );
}
