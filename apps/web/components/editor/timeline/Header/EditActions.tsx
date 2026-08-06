"use client";

import { Scissors, Trash2, Undo2, Redo2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  disabled?: boolean;
};

const btn =
  "inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)] disabled:cursor-not-allowed disabled:opacity-35";

/** Presentational edit actions — split/delete noop until phase 2. */
export function EditActions({
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  disabled,
}: Props) {
  return (
    <div className="flex items-center gap-0.5" data-testid="timeline-edit-actions">
      <button
        type="button"
        className={btn}
        aria-label="Undo"
        disabled={disabled || !canUndo}
        onClick={onUndo}
      >
        <Undo2 size={14} />
      </button>
      <button
        type="button"
        className={btn}
        aria-label="Redo"
        disabled={disabled || !canRedo}
        onClick={onRedo}
      >
        <Redo2 size={14} />
      </button>
      <button
        type="button"
        className={cn(btn)}
        aria-label="Split"
        disabled
        title="Split (phase 2)"
      >
        <Scissors size={14} />
      </button>
      <button
        type="button"
        className={btn}
        aria-label="Delete"
        disabled
        title="Delete (phase 2)"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
