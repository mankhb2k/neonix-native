"use client";

import { useState } from "react";
import { ChatDock } from "./ChatDock";
import { Inspector } from "./Inspector";

type RightTab = "basic" | "ai";

export function RightDock() {
  const [tab, setTab] = useState<RightTab>("ai");

  return (
    <aside className="flex flex-col overflow-y-auto border-l border-[var(--line)] bg-[var(--bg-panel)] p-0 [grid-area:rightdock]">
      <div className="flex border-b border-[var(--line-strong)]" role="tablist" aria-label="Panel phải">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "basic"}
          className={`flex-1 cursor-pointer p-3 text-center text-[14px] text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)] ${tab === "basic" ? "border-b-2 border-[var(--fg)] font-medium text-[var(--fg)]" : ""}`}
          onClick={() => setTab("basic")}
        >
          Cơ bản
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "ai"}
          className={`flex-1 cursor-pointer p-3 text-center text-[14px] text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)] ${tab === "ai" ? "border-b-2 border-[var(--fg)] font-medium text-[var(--fg)]" : ""}`}
          onClick={() => setTab("ai")}
        >
          AI Copilot
        </button>
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto p-4">
        {tab === "basic" ? (
          <div className="flex flex-col gap-4">
            <Inspector />
          </div>
        ) : (
          <ChatDock embedded />
        )}
      </div>
    </aside>
  );
}
