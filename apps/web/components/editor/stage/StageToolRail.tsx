"use client";

import { ShapesDropdown } from "@/components/editor/header/shapes/ShapesDropdown";
import { TextDropdown } from "@/components/editor/header/text/TextDropdown";
import { useLibraryPointerGesture } from "@/hooks/editor/use-library-pointer-gesture";
import { Hand, MousePointer2, PenTool } from "lucide-react";

type Props = {
  isPanMode: boolean;
  onSelectTool: () => void;
  onPanTool: () => void;
};

const toolButton =
  "inline-flex h-8 w-8 items-center justify-center rounded-md border-0 text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]";

// Path drawing will ship after MVP. Keep the tool implementation ready, but hidden.
const PATH_TOOL_ENABLED = false;

function PathToolButton() {
  const { onPointerDown, onKeyDown } = useLibraryPointerGesture({
    kind: "path",
    id: "path-tool",
    label: "Path",
    duration: 5,
  });
  return (
    <button
      type="button"
      className={toolButton}
      aria-label="Path tool"
      title="Path"
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      <PenTool size={16} strokeWidth={1.8} />
    </button>
  );
}

/** Stage-local tool palette, kept separate from project-level header actions. */
export function StageToolRail({ isPanMode, onSelectTool, onPanTool }: Props) {
  return (
    <div
      className="absolute left-3 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/95 p-1 shadow-md"
      data-testid="stage-tool-rail"
      aria-label="Stage tools"
    >
      <button
        type="button"
        className={`${toolButton} ${!isPanMode ? "bg-[var(--accent-soft)] text-[var(--accent-text)]" : ""}`}
        aria-label="Select tool"
        title="Select (V)"
        aria-pressed={!isPanMode}
        onClick={onSelectTool}
      >
        <MousePointer2 size={16} strokeWidth={1.8} />
      </button>
      <button
        type="button"
        className={`${toolButton} ${isPanMode ? "bg-[var(--accent-soft)] text-[var(--accent-text)]" : ""}`}
        aria-label="Pan tool"
        title="Pan (H)"
        aria-pressed={isPanMode}
        onClick={onPanTool}
      >
        <Hand size={16} strokeWidth={1.8} />
      </button>
      <span className="my-0.5 h-px w-5 bg-[var(--border-subtle)]" aria-hidden="true" />
      <ShapesDropdown compact includePath={false} menuPlacement="right" />
      {PATH_TOOL_ENABLED ? <PathToolButton /> : null}
      <TextDropdown compact menuPlacement="right" />
    </div>
  );
}
