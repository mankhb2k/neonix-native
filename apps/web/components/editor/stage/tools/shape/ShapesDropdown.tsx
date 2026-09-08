"use client";

import { ChevronDown, Circle, PenTool, Shapes, Square } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useShapeTool } from "./use-shape-tool";

const menuBtn =
  "inline-flex h-8 items-center gap-1 rounded-lg border-0 bg-transparent px-2 text-[13px] font-medium text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]";

export type ShapeTool = "rectangle" | "ellipse" | "path";

type ShapeOption = {
  id: ShapeTool;
  label: string;
  icon: typeof Square;
};

const SHAPE_OPTIONS: ShapeOption[] = [
  { id: "rectangle", label: "Rectangle", icon: Square },
  { id: "ellipse", label: "Ellipse", icon: Circle },
  { id: "path", label: "Path", icon: PenTool },
];

function ShapeMenuItem({ option, onSelect }: { option: ShapeOption; onSelect?: (shape: ShapeTool) => void }) {
  const { onPointerDown, onKeyDown } = useShapeTool(option.id, option.label);
  const Icon = option.icon;
  const isPath = option.id === "path";
  return (
    <button
      type="button"
      role="menuitem"
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]"
      data-shape={option.id}
      onClick={isPath ? () => onSelect?.(option.id) : undefined}
      onPointerDown={isPath ? undefined : onPointerDown}
      onKeyDown={isPath ? undefined : onKeyDown}
    >
      <Icon size={17} strokeWidth={1.75} aria-hidden />
      <span className="font-medium">{option.label}</span>
    </button>
  );
}
type Props = {
  className?: string;
  onSelect?: (shape: ShapeTool) => void;
  compact?: boolean;
  menuPlacement?: "bottom" | "right";
  includePath?: boolean;
};

/** Shape tool menu for the V2 stage toolbar. */
export function ShapesDropdown({
  className,
  onSelect,
  compact = false,
  menuPlacement = "bottom",
  includePath = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

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
        title="Shape"
        aria-label="Shape tool"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        data-testid="editor-shapes-menu"
      >
        <Shapes size={compact ? 17 : 14} strokeWidth={1.75} />
        {!compact ? (
          <>
            Shape
            <ChevronDown
              size={12}
              className={cn("opacity-70 transition-transform", open && "rotate-180")}
            />
          </>
        ) : null}
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Shape tools"
          className={cn(
            "absolute z-50 min-w-[160px] rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-1.5 shadow-lg",
            menuPlacement === "right"
              ? "top-0 left-[calc(100%+6px)]"
              : "top-[calc(100%+6px)] left-0",
          )}
        >
          {SHAPE_OPTIONS.filter((option) => includePath || option.id !== "path").map((option) => <ShapeMenuItem key={option.id} option={option} onSelect={(shape) => { onSelect?.(shape); setOpen(false); }} />)}
        </div>
      ) : null}
    </div>
  );
}

