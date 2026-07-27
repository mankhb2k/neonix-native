"use client";

import { useEffect, useState, type CSSProperties } from "react";

export function DesktopMenuBar() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const api = typeof window !== "undefined" ? window.motionvideoDesktop : undefined;
  if (!api || api.getInfo === undefined) return null;

  return (
    <div
      className="flex items-center gap-1 text-[12px] text-[var(--fg-muted)] select-none"
      style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
    >
      <button
        type="button"
        className="px-2 py-0.5 rounded hover:bg-[var(--bg-hover)] hover:text-[var(--fg)] transition-colors cursor-pointer"
      >
        Tệp
      </button>
      <button
        type="button"
        className="px-2 py-0.5 rounded hover:bg-[var(--bg-hover)] hover:text-[var(--fg)] transition-colors cursor-pointer"
      >
        Chỉnh sửa
      </button>
      <button
        type="button"
        className="px-2 py-0.5 rounded hover:bg-[var(--bg-hover)] hover:text-[var(--fg)] transition-colors cursor-pointer"
      >
        Xem
      </button>
      <button
        type="button"
        className="px-2 py-0.5 rounded hover:bg-[var(--bg-hover)] hover:text-[var(--fg)] transition-colors cursor-pointer"
      >
        Trợ giúp
      </button>
    </div>
  );
}
