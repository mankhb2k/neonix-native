"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { Sparkles } from "lucide-react";

const SCOPES = [
  { id: "video", label: "Video" },
  { id: "scene", label: "Scene" },
  { id: "element", label: "Element" },
  { id: "motion", label: "Motion" },
] as const;

export function AskAIBar() {
  const [scope, setScope] = useState<(typeof SCOPES)[number]["id"]>("video");
  const [prompt, setPrompt] = useState("");

  return (
    <footer
      className="editor-area-ask flex items-center gap-3 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3"
      data-testid="editor-ask-ai"
    >
      <div className="flex shrink-0 items-center gap-1.5 text-[var(--accent-text)]">
        <Sparkles size={16} />
        <span className="text-[12px] font-semibold tracking-tight">Ask AI</span>
      </div>

      <div className="flex shrink-0 gap-1">
        {SCOPES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={
              scope === item.id
                ? "h-7 rounded-[var(--radius-sm)] bg-[var(--accent-soft)] px-2 text-[11px] font-medium text-[var(--accent-text)] cursor-pointer border-0"
                : "h-7 rounded-[var(--radius-sm)] bg-transparent px-2 text-[11px] font-medium text-[var(--fg-muted)] hover:text-[var(--fg-secondary)] cursor-pointer border-0"
            }
            onClick={() => setScope(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <input
        type="text"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Mô tả brief hoặc chỉnh sửa scoped… (jobs UI ở PR7)"
        className="h-9 min-w-0 flex-1 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--bg-app)] px-3 text-[13px] text-[var(--fg-primary)] outline-none placeholder:text-[var(--fg-disabled)] focus:border-[var(--border-focus)]"
        disabled
      />

      <Button variant="primary" size="md" disabled title="AI jobs (PR7)">
        Generate
      </Button>
    </footer>
  );
}
