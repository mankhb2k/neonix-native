"use client";

import type { CSSProperties } from "react";

const ITEMS = ["File", "Edit", "View", "Window", "Help"] as const;

type Props = {
  className?: string;
};

/**
 * Cursor-style text menus for the custom Electron title bar.
 * Actions are stubs for now — wire IPC / commands later.
 */
export function DesktopMenuBar({ className = "" }: Props) {
  return (
    <nav
      className={`flex items-center gap-0.5 ${className}`}
      aria-label="Application menu"
      style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
    >
      {ITEMS.map((label) => (
        <button
          key={label}
          type="button"
          className="cursor-default rounded-sm border-0 bg-transparent px-2 py-0.5 text-[12px] text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]"
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
