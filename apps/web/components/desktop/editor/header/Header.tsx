"use client";

import { TitleBar } from "./TitleBar/TitleBar";
import { RibbonBar } from "./RibbonBar/RibbonBar";

export function Header() {
  return (
    <header className="col-span-full flex h-[74px] flex-col bg-[var(--bg-panel)] z-20 [grid-area:header]">
      <TitleBar />
      <RibbonBar />
    </header>
  );
}
