"use client";

import { TitleBar } from "./TitleBar/TitleBar";
import { RibbonBar } from "./RibbonBar/RibbonBar";

export function Header() {
  return (
    <header className="mv-ppt-header">
      <TitleBar />
      <RibbonBar />
    </header>
  );
}
