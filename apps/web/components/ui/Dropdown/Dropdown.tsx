"use client";

import {
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export type DropdownItem =
  | { type: "divider" }
  | {
      type?: "item";
      label: string;
      icon?: ReactNode;
      danger?: boolean;
      disabled?: boolean;
      onSelect?: () => void;
    };

export type DropdownProps = {
  trigger: ReactElement<ButtonHTMLAttributes<HTMLButtonElement>>;
  items: DropdownItem[];
  align?: "start" | "end";
  label?: string;
  className?: string;
  menuClassName?: string;
};

export function Dropdown({
  trigger,
  items,
  align = "start",
  label,
  className,
  menuClassName,
}: DropdownProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const selectableIndexes = items
    .map((item, index) => (item.type === "divider" ? -1 : index))
    .filter((index) => index !== -1);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (open && highlightedIndex >= 0) itemRefs.current[highlightedIndex]?.focus();
  }, [open, highlightedIndex]);

  const close = () => setOpen(false);

  const moveHighlight = (direction: 1 | -1) => {
    if (selectableIndexes.length === 0) return;
    const currentPosition = selectableIndexes.indexOf(highlightedIndex);
    const basePosition = currentPosition === -1 ? (direction === 1 ? -1 : 0) : currentPosition;
    const nextPosition =
      (basePosition + direction + selectableIndexes.length) % selectableIndexes.length;
    setHighlightedIndex(selectableIndexes[nextPosition]);
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveHighlight(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveHighlight(-1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
      rootRef.current?.querySelector<HTMLButtonElement>("[aria-haspopup='menu']")?.focus();
    }
  };

  const triggerElement = isValidElement(trigger)
    ? cloneElement(trigger, {
        "aria-haspopup": "menu",
        "aria-expanded": open,
        onClick: (event) => {
          trigger.props.onClick?.(event);
          setOpen((current) => {
            const next = !current;
            if (next) setHighlightedIndex(selectableIndexes[0] ?? -1);
            return next;
          });
        },
      })
    : trigger;

  return (
    <div ref={rootRef} className={cn("relative inline-block", className)}>
      {triggerElement}
      {open ? (
        <div
          role="menu"
          aria-label={label}
          onKeyDown={handleMenuKeyDown}
          className={cn(
            "absolute z-50 mt-1.5 min-w-48 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-site)] p-1 shadow-[0_18px_50px_rgba(15,23,42,0.18)]",
            align === "end" ? "right-0" : "left-0",
            menuClassName,
          )}
        >
          {items.map((item, index) =>
            item.type === "divider" ? (
              // eslint-disable-next-line react/no-array-index-key
              <div key={`divider-${index}`} className="my-1 border-t border-[var(--border-subtle)]" />
            ) : (
              <button
                key={item.label}
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                tabIndex={-1}
                onClick={() => {
                  if (item.disabled) return;
                  item.onSelect?.();
                  close();
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] font-medium transition-colors",
                  item.danger
                    ? "text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]"
                    : "text-[var(--fg-primary)] hover:bg-[var(--bg-hover)]",
                  index === highlightedIndex &&
                    (item.danger
                      ? "bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]"
                      : "bg-[var(--bg-hover)]"),
                  item.disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
                )}
              >
                {item.icon ? <span className="shrink-0 text-[var(--fg-muted)]">{item.icon}</span> : null}
                <span className="truncate">{item.label}</span>
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
