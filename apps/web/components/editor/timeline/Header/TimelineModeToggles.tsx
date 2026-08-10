"use client";

import { Magnet } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  snapOn: boolean;
  onToggleSnap: () => void;
  disabled?: boolean;
};

export function TimelineModeToggles({ snapOn, onToggleSnap, disabled }: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={snapOn}
      aria-label="Snap"
      title="Snap"
      onClick={onToggleSnap}
      className={cn(
        "inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-0 transition-colors disabled:opacity-40",
        snapOn
          ? "bg-[var(--accent-soft)] text-[var(--accent-text)]"
          : "bg-transparent text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]",
      )}
    >
      <Magnet size={14} />
    </button>
  );
}
