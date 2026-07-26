"use client";

import { useEffect, useState, type CSSProperties } from "react";

/**
 * Custom caption buttons for frameless Electron (needed so DevTools can dock).
 * Matches VS Code / Windows 11 window controls style (single square for maximize, 
 * two overlapping squares for restore down).
 * Hidden on macOS — traffic lights are native with hiddenInset.
 */
export function DesktopWindowControls() {
  const [mounted, setMounted] = useState(false);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const api = typeof window !== "undefined" ? window.motionvideoDesktop : undefined;

  useEffect(() => {
    if (!api) return;
    const updateState = () => {
      void api.windowIsMaximized?.().then((isMax) => setMaximized(Boolean(isMax)));
    };
    updateState();

    window.addEventListener("resize", updateState);
    return () => window.removeEventListener("resize", updateState);
  }, [api]);

  if (!mounted || !api || api.getInfo === undefined) return null;

  // macOS uses native traffic lights.
  if (typeof navigator !== "undefined" && /Mac/i.test(navigator.platform)) {
    return null;
  }

  const btn =
    "inline-flex h-[38px] w-[46px] cursor-default items-center justify-center border-0 bg-transparent text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg)] transition-colors";

  return (
    <div
      aria-label="Window controls"
      className="flex h-[38px] shrink-0 items-center justify-end border-b border-[var(--line)] bg-[var(--bg-panel)] text-[var(--fg)] select-none"
      style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
    >
      <button
        type="button"
        title="Thu nhỏ"
        className={btn}
        onClick={() => void api.windowMinimize?.()}
      >
        <svg width="10" height="1" viewBox="0 0 10 1" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="10" height="1" fill="currentColor" />
        </svg>
      </button>

      <button
        type="button"
        title={maximized ? "Phóng nhỏ" : "Phóng to"}
        className={btn}
        onClick={() => {
          void api.windowMaximize?.().then((isMax) => setMaximized(Boolean(isMax)));
        }}
      >
        {maximized ? (
          /* VS Code Restore Down Icon: 2 overlapping squares */
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M3 1.5H8.5V7"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeLinecap="square"
            />
            <rect
              x="1.5"
              y="3.5"
              width="5.5"
              height="5.5"
              stroke="currentColor"
              strokeWidth="1.1"
            />
          </svg>
        ) : (
          /* VS Code Maximize Icon: single square */
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect
              x="1"
              y="1"
              width="8"
              height="8"
              stroke="currentColor"
              strokeWidth="1.1"
            />
          </svg>
        )}
      </button>

      <button
        type="button"
        title="Đóng"
        className={`${btn} hover:bg-[#e81123] hover:text-white`}
        onClick={() => void api.windowClose?.()}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0.5 0.5L9.5 9.5M9.5 0.5L0.5 9.5" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
    </div>
  );
}
