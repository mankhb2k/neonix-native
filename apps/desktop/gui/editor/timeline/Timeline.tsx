import { PanelHeader } from "../../ui";

/** Bottom timeline board (web Timeline). */
export function Timeline({ focus }: { focus?: boolean }) {
  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden"
      data-testid="timeline-viewport"
      data-timeline-focus={focus ? "true" : undefined}
    >
      <PanelHeader title="Timeline" />
      <div className="flex flex-1 items-center justify-center p-4 text-[12px] text-[var(--fg-muted)]">
        Tracks · Transport
      </div>
    </div>
  );
}
