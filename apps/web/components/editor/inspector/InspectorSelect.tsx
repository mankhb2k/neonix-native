"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

export type InspectorSelectOption = {
  value: string;
  label: string;
  group?: string;
};

export type InspectorSelectProps = {
  label: string;
  value: string;
  options: readonly InspectorSelectOption[];
  onChange: (value: string) => void;
  className?: string;
};

const triggerClass =
  "flex h-7 w-full max-w-[7rem] items-center justify-between gap-1 rounded-md border border-[var(--border-strong)] bg-[var(--bg-site)] px-2 text-left text-[12px] text-[var(--fg-primary)] outline-none transition-colors focus:border-[var(--border-focus)]";

/** Styled listbox used by the Protocol V2 inspector instead of Chrome's native select popup. */
export function InspectorSelect({ label, value, options, onChange, className = "" }: InspectorSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const [highlightedIndex, setHighlightedIndex] = useState(selectedIndex);
  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    if (open) optionRefs.current[highlightedIndex]?.focus();
  }, [highlightedIndex, open]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    setHighlightedIndex(selectedIndex);
  }, [selectedIndex]);

  const selectOption = (option: InspectorSelectOption) => {
    onChange(option.value);
    setOpen(false);
  };

  const moveHighlight = (direction: 1 | -1) => {
    if (options.length === 0) return;
    setHighlightedIndex((current) => (current + direction + options.length) % options.length);
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex(selectedIndex);
      setOpen(true);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setHighlightedIndex(selectedIndex);
      setOpen((current) => !current);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  const handleOptionKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveHighlight(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveHighlight(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      setHighlightedIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setHighlightedIndex(Math.max(0, options.length - 1));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const option = options[highlightedIndex];
      if (option) selectOption(option);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      rootRef.current?.querySelector<HTMLButtonElement>("[aria-haspopup='listbox']")?.focus();
    }
  };

  return (
    <div ref={rootRef} className="relative flex min-w-0 items-center justify-between gap-2">
      <span className="shrink-0 text-[11px] text-[var(--fg-muted)]">{label}</span>
      <div className="relative min-w-0 w-full max-w-[7rem]">
        <button
          type="button"
          className={`${triggerClass} ${className}`.trim()}
          aria-label={label}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => {
            setHighlightedIndex(selectedIndex);
            setOpen((current) => !current);
          }}
          onKeyDown={handleTriggerKeyDown}
        >
          <span className="min-w-0 truncate">{selectedOption?.label ?? value}</span>
          <ChevronDown size={13} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
        {open ? (
          <div
            role="listbox"
            aria-label={label}
            className="absolute right-0 top-[calc(100%+4px)] z-50 max-h-52 min-w-full overflow-y-auto rounded-md border border-[var(--border-strong)] bg-[var(--bg-site)] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
          >
            {options.map((option, index) => (
              <div key={option.value}>
                {option.group && (index === 0 || option.group !== options[index - 1]?.group) ? (
                  <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--fg-muted)] first:pt-1">
                    {option.group}
                  </div>
                ) : null}
                <button
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  tabIndex={-1}
                  className={`flex min-h-7 w-full items-center rounded px-2 text-left text-[12px] ${
                    index === highlightedIndex
                      ? "bg-[var(--bg-hover)] text-[var(--fg-primary)]"
                      : "text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]"
                  }`}
                  onClick={() => selectOption(option)}
                  onKeyDown={handleOptionKeyDown}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <span className="truncate">{option.label}</span>
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
