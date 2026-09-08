"use client";

import { Type } from "lucide-react";
import { useLibraryPointerGesture } from "@/hooks/editor/use-library-pointer-gesture";
import { cn } from "@/lib/utils";

const DEFAULT_TEXT_DURATION = 5;
const DEFAULT_TEXT_VALUE = "Text";

type Props = {
  className?: string;
};

/** Single-click tool that inserts the canonical default text layer. */
export function TextToolButton({ className }: Props) {
  const gesture = useLibraryPointerGesture({
    kind: "text",
    id: "text-default",
    label: "Text",
    text: DEFAULT_TEXT_VALUE,
    duration: DEFAULT_TEXT_DURATION,
  });

  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent p-0 text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-hover)]",
        className,
      )}
      title="Add text"
      aria-label="Text tool"
      data-testid="editor-text-tool"
      onPointerDown={gesture.onPointerDown}
      onKeyDown={gesture.onKeyDown}
    >
      <Type size={17} strokeWidth={1.75} />
    </button>
  );
}
