import { PanelHeader } from "../../ui";

/** Left dock — library / layers (web Sidebar). */
export function Sidebar() {
  return (
    <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <PanelHeader title="Sidebar" />
      <div className="flex flex-1 items-center justify-center p-4 text-[12px] text-[var(--fg-muted)]">
        Media · Layers · Elements
      </div>
    </aside>
  );
}
