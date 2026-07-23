"use client";

import { Inspector } from "./Inspector";

export function RightDock() {
  return (
    <aside className="flex flex-col overflow-hidden border-l border-[var(--line)] bg-[var(--bg-panel)] [grid-area:rightdock]">
      <Inspector />
    </aside>
  );
}
