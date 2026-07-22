"use client";

import { useState } from "react";
import { ChatDock } from "./ChatDock";
import { Inspector } from "./Inspector";

type RightTab = "basic" | "ai";

export function RightDock() {
  const [tab, setTab] = useState<RightTab>("ai");

  return (
    <aside className="mv-right-dock">
      <div className="mv-right-tabs" role="tablist" aria-label="Panel phải">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "basic"}
          className={`mv-right-tab${tab === "basic" ? " is-active" : ""}`}
          onClick={() => setTab("basic")}
        >
          Cơ bản
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "ai"}
          className={`mv-right-tab${tab === "ai" ? " is-active" : ""}`}
          onClick={() => setTab("ai")}
        >
          AI Copilot
        </button>
      </div>
      <div className="mv-right-body">
        {tab === "basic" ? (
          <div className="mv-right-basic">
            <Inspector />
          </div>
        ) : (
          <ChatDock embedded />
        )}
      </div>
    </aside>
  );
}
