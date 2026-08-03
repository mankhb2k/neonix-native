import { memo } from "react";
import { PanelHeader } from "../../ui";

/** Right dock — inspector (web RightDock). */
export const RightDock = memo(function RightDock() {
  return (
    <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <PanelHeader title="Inspector" />
      <div className="flex flex-1 items-center justify-center p-4 text-[12px] text-[var(--fg-muted)]">
        Properties
      </div>
    </aside>
  );
});
