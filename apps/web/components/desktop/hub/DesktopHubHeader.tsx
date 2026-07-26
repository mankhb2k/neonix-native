"use client";

import type { CSSProperties } from "react";
import { AppLink } from "@/components/AppLink";
import { DesktopMenuBar } from "@/components/desktop/editor/DesktopMenuBar";
import { DesktopWindowControls } from "@/components/desktop/editor/DesktopWindowControls";

export function DesktopHubHeader() {
  return (
    <header
      className="h-[38px] w-full bg-[#18181a] border-b border-[#28282b] flex items-center justify-between px-3 select-none text-[12px] text-[#a0a0a5] shrink-0"
      style={{ WebkitAppRegion: "drag" } as CSSProperties}
    >
      {/* Left: MotionVideo Logo Badge & Vietnamese Menu Bar */}
      <div className="flex items-center gap-3">
        <div style={{ WebkitAppRegion: "no-drag" } as CSSProperties}>
          <AppLink href="/" className="flex items-center gap-2 no-underline" title="Trang chủ">
            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-[4px] bg-[#d9381e] text-[12px] font-bold text-white shadow-sm">
              M
            </span>
            <span className="font-semibold text-[13px] text-white tracking-tight">
              MotionVideo
            </span>
          </AppLink>
        </div>

        {/* Vietnamese Desktop Menu Bar */}
        <div style={{ WebkitAppRegion: "no-drag" } as CSSProperties}>
          <DesktopMenuBar />
        </div>
      </div>

      {/* Right: Window Controls */}
      <div className="flex items-center gap-2" style={{ WebkitAppRegion: "no-drag" } as CSSProperties}>
        <DesktopWindowControls />
      </div>
    </header>
  );
}
