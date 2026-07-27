"use client";

import { TitleBar } from "./TitleBar/TitleBar";

export function Header() {
  return (
    <header className="col-span-full flex h-[38px] flex-col bg-[var(--bg-panel)] z-20 [grid-area:header]">
      <TitleBar />
    </header>
  );
}
