"use client";

export function MinimalTimeline() {
  return (
    <section
      className="flex h-full min-h-0 flex-col"
      data-testid="editor-timeline"
    >
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-muted)]">
          Timeline
        </span>
        <span className="text-[11px] text-[var(--fg-muted)]">
          Scenes · clips — nằm trong vùng stage
        </span>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-4">
        <p className="editor-placeholder max-w-md text-center">
          Timeline tối thiểu (scene strip + clip lanes). Trim/move và playback
          clock sẽ nối khi Remotion sẵn sàng.
        </p>
      </div>
    </section>
  );
}
