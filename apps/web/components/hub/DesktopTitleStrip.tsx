"use client";

import { useEffect, useState, type CSSProperties } from "react";

/** Electron drag strip — no-ops in pure browser. Moved out of deleted desktop tree. */
export function DesktopTitleStrip() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const api =
    typeof window !== "undefined" ? window.motionvideoDesktop : undefined;
  if (!api || api.getInfo === undefined) return null;

  return (
    <div
      aria-label="Application header drag area"
      className="flex h-8 shrink-0 select-none items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] px-3 text-[12px] text-[var(--fg-muted)]"
      style={{ WebkitAppRegion: "drag" } as CSSProperties}
    >
      <span className="font-medium text-[var(--fg-primary)]">MotionVideo</span>
      <span className="text-[11px] opacity-70">Sẵn sàng</span>
    </div>
  );
}
