"use client";

import type { CSSProperties } from "react";
import { DesktopMenuBar } from "./DesktopMenuBar";
import { DesktopWindowControls } from "./DesktopWindowControls";
import { useIsDesktop } from "@/lib/desktop";

/**
 * Thin drag strip for hub / non-editor routes in Electron.
 * Editor uses TitleBar instead (same menus + drag).
 */
export function DesktopTitleStrip() {
  const isDesktop = useIsDesktop();
  if (!isDesktop) return null;

  return (
    <div
      className="desktop-titlebar flex h-[38px] shrink-0 items-center gap-2 border-b border-[var(--line)] bg-[var(--bg-panel)] pl-3"
      style={{ WebkitAppRegion: "drag" } as CSSProperties}
    >
      <span
        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] bg-[#d9381e] text-[10px] font-bold text-white"
        style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
      >
        M
      </span>
      <DesktopMenuBar />
      <DesktopWindowControls />
    </div>
  );
}
