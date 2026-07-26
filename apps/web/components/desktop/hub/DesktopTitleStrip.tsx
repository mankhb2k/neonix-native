"use client";

import { useEffect, useState, type CSSProperties } from "react";

export function DesktopTitleStrip() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const api = typeof window !== "undefined" ? window.motionvideoDesktop : undefined;
  if (!api || api.getInfo === undefined) return null;

  return (
    <div
      aria-label="Application header drag area"
      className="h-8 shrink-0 bg-[var(--bg-panel)] border-b border-[var(--line)] flex items-center justify-between px-3 select-none text-[12px] text-[var(--fg-muted)]"
      style={{ WebkitAppRegion: "drag" } as CSSProperties}
    >
      <span className="font-medium text-[var(--fg)]">MotionVideo Desktop</span>
      <span className="text-[11px] opacity-70">Sẵn sàng</span>
    </div>
  );
}
