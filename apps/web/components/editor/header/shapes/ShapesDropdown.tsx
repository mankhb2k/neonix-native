"use client";

import { cn } from "@/lib/utils";
import { ChevronDown, Circle, PenTool, Shapes, Square } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

const menuBtn =
  "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-transparent px-2.5 text-[14px] font-medium text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]";

export type ShapeTool = "rectangle" | "ellipse" | "path";

type ShapeOption = {
  id: ShapeTool;
  label: string;
  hint: string;
  icon: typeof Square;
};

const SHAPE_OPTIONS: ShapeOption[] = [
  { id: "rectangle", label: "Rectangle", hint: "Hình chữ nhật", icon: Square },
  { id: "ellipse", label: "Ellipse", hint: "Hình elip", icon: Circle },
  { id: "path", label: "Path", hint: "Đường path tự do", icon: PenTool },
];

type Props = {
  className?: string;
  onSelect?: (shape: ShapeTool) => void;
};

/** Shape tool menu for the V2 editor header. */
export function ShapesDropdown({ className, onSelect }: Props) {
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
        className={cn(menuBtn, open && "bg-[var(--bg-hover)] text-[var(--fg-primary)]")}
        title="Shape"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        data-testid="editor-shapes-menu"
      >
        <Shapes size={16} strokeWidth={1.75} />
        Shape
        <ChevronDown
          size={14}
          className={cn("opacity-70 transition-transform", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Shape tools"
          className="absolute top-[calc(100%+6px)] left-0 z-50 min-w-[220px] rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-1.5 shadow-lg"
        >
          {SHAPE_OPTIONS.map(({ id, label, hint, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]"
              data-shape={id}
              onClick={() => {
                onSelect?.(id);
                setOpen(false);
              }}
            >
              <Icon size={17} strokeWidth={1.75} aria-hidden />
              <span className="flex flex-col">
                <span className="font-medium">{label}</span>
                <span className="text-[11px] text-[var(--fg-muted)]">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
