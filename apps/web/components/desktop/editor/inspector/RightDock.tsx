"use client";

import { Inspector } from "./Inspector";

export function RightDock() {
  return (
    <aside className="flex flex-col overflow-hidden [grid-area:rightdock]">
      <Inspector />
    </aside>
  );
}
