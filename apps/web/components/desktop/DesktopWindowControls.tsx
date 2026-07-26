"use client";

import { useEffect, useState, type CSSProperties } from "react";

/**
 * Custom caption buttons for frameless Electron (needed so DevTools can dock).
 * Matches VS Code / Windows 11 window controls style (single square for maximize, 
 * two overlapping squares for restore down).
 * Hidden on macOS — traffic lights are native with hiddenInset.
 */
export function DesktopWindowControls() {
  const [maximized, setMaximized] = useState(false);
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

  if (!api || api.getInfo === undefined) return null;

  // macOS uses native traffic lights.
  if (typeof navigator !== "undefined" && /Mac/i.test(navigator.platform)) {
    return null;
  }

  const btn =
    "inline-flex h-[38px] w-[46px] cursor-default items-center justify-center border-0 bg-transparent text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg)] transition-colors";

  return (
    <div
      className="ml-auto flex h-[38px] shrink-0 items-stretch"
      style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
    >
      <button
        type="button"
        aria-label="Minimize"
        className={btn}
        onClick={() => void api.windowMinimize?.()}
      >
        <svg width="10" height="1" viewBox="0 0 10 1" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="10" height="1" fill="currentColor" />
        </svg>
      </button>

      <button
        type="button"
        aria-label={maximized ? "Restore" : "Maximize"}
        className={btn}
        onClick={() => {
          void api.windowMaximize?.().then(setMaximized);
        }}
      >
        {maximized ? (
          /* VS Code style Restore Down Icon (2 overlapping squares) */
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.5 2.5V0.5H9.5V7.5H7.5" stroke="currentColor" strokeWidth="1" />
            <rect x="0.5" y="2.5" width="7" height="7" stroke="currentColor" strokeWidth="1" />
          </svg>
        ) : (
          /* VS Code style Maximize Icon (1 single square) */
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" />
          </svg>
        )}
      </button>

      <button
        type="button"
        aria-label="Close"
        className={`${btn} hover:bg-[#E81123] hover:text-white`}
        onClick={() => void api.windowClose?.()}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0.5 0.5L9.5 9.5M9.5 0.5L0.5 9.5" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
    </div>
  );
}

