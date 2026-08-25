"use client";

import { useLibraryPointerGesture } from "@/hooks/editor/use-library-pointer-gesture";
import { cn } from "@/lib/utils";
import { ChevronDown, Type } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { TEXT_CATEGORIES } from "./catalog";
import type { TextPreset } from "./types";
import { getLibraryDragSession } from "@/lib/editor/library/library-drag-session";

const DEFAULT_FRAME_DURATION = 5;

const menuBtn =
  "inline-flex h-8 items-center gap-1 rounded-lg border-0 bg-transparent px-2 text-[13px] font-medium text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]";

function TextTile({ item }: { item: TextPreset }) {
  const { onPointerDown, onKeyDown } = useLibraryPointerGesture({
    kind: "text",
    id: item.id,
    label: item.label,
    text: item.text,
    duration: DEFAULT_FRAME_DURATION,
  });

  return (
    <button
      type="button"
      title={`${item.label} — kéo vào board/timeline hoặc click để thêm`}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className="inline-flex h-12 w-12 items-center justify-center rounded-lg transition-colors hover:bg-[var(--bg-hover)]"
    >
      {item.preview}
    </button>
  );
}

type Props = {
  className?: string;
  compact?: boolean;
  menuPlacement?: "bottom" | "right";
};

export function TextDropdown({
  className,
  compact = false,
  menuPlacement = "bottom",
}: Props) {
  const quickTextGesture = useLibraryPointerGesture({
    kind: "text",
    id: "text-default",
    label: "Text",
    text: "Tiêu đề",
    duration: DEFAULT_FRAME_DURATION,
  });
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: MouseEvent) => {
      if (getLibraryDragSession().phase === "dragging") return;
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const phase = getLibraryDragSession().phase;
      if (phase === "pressed" || phase === "dragging") return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (compact) {
    return (
      <button
        type="button"
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent p-0 text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]",
        )}
        title="Thêm text"
        aria-label="Text tool"
        data-testid="editor-text-tool"
        onPointerDown={quickTextGesture.onPointerDown}
        onKeyDown={quickTextGesture.onKeyDown}
      >
        <Type size={17} strokeWidth={1.75} />
      </button>
    );
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        className={cn(
          compact
            ? "inline-flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent p-0 text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]"
            : menuBtn,
          open && "bg-[var(--bg-hover)] text-[var(--fg-primary)]",
        )}
        title="Text"
        aria-label="Text tool"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        data-testid="editor-text-menu"
      >
        <Type size={compact ? 17 : 14} strokeWidth={1.75} />
        {!compact ? (
          <>
            Text
            <ChevronDown
              size={12}
              className={cn("opacity-70 transition-transform", open && "rotate-180")}
            />
          </>
        ) : null}
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Thư viện Text"
          className={cn(
            "absolute z-50 max-h-[min(70vh,480px)] w-[280px] overflow-y-auto rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-3 shadow-lg",
            menuPlacement === "right"
              ? "top-0 left-[calc(100%+6px)]"
              : "top-[calc(100%+6px)] left-0",
          )}
        >
          <p className="mb-3 text-[11px] text-[var(--fg-muted)]">
            Click để thêm · kéo thả vào board / timeline
          </p>
          <div className="flex flex-col gap-4">
            {TEXT_CATEGORIES.map((category) => (
              <div key={category.title}>
                <h4 className="mb-1.5 text-[12px] font-semibold text-[var(--fg-primary)]">
                  {category.title}
                </h4>
                <div className="flex flex-wrap gap-1">
                  {category.items.map((item) => (
                    <TextTile key={item.id} item={item} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
