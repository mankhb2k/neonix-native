import type { ReactNode } from "react";

/**
 * Standard figure card for docs: light stage, mono label on top,
 * optional caption below. Pure illustration — no runtime preview.
 */
export function Figure({
  label,
  caption,
  children,
  stageClassName,
}: {
  /** Mono label shown above the stage, e.g. "layers[]" or "group.children". */
  label?: string;
  /** One-line explanation under the stage. */
  caption?: ReactNode;
  children: ReactNode;
  /** Override stage padding/height. */
  stageClassName?: string;
}) {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border border-[var(--border-subtle,#e4e4e7)] bg-[var(--bg-elevated)]">
      {label ? (
        <figcaption className="border-b border-[var(--border-subtle,#e4e4e7)] px-4 py-2 font-mono text-[11px] text-[var(--fg-muted)]">
          {label}
        </figcaption>
      ) : null}
      <div
        className={`flex items-center justify-center bg-[var(--bg-surface)] px-6 py-8 ${
          stageClassName ?? ""
        }`}
      >
        {children}
      </div>
      {caption ? (
        <p className="border-t border-[var(--border-subtle,#e4e4e7)] px-4 py-3 text-[13px] leading-6 text-[var(--fg-muted)]">
          {caption}
        </p>
      ) : null}
    </figure>
  );
}
