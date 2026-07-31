"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SegmentedControlOption {
  value: string;
  label?: ReactNode;
  icon?: ReactNode;
  tooltip?: string;
  disabled?: boolean;
}

export interface SegmentedControlProps {
  options: SegmentedControlOption[];
  value: string;
  onChange: (value: string) => void;
  size?: "sm" | "md";
  className?: string;
  fullWidth?: boolean;
}

export function SegmentedControl({
  options,
  value,
  onChange,
  size = "sm",
  className,
  fullWidth = true,
}: SegmentedControlProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-[5px] bg-[var(--bg-hover,#262626)] p-0.5 select-none",
        fullWidth && "w-full flex",
        className
      )}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            title={option.tooltip}
            disabled={option.disabled}
            onClick={() => !option.disabled && onChange(option.value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1 rounded-[3.5px] font-medium transition-all focus:outline-none disabled:opacity-40",
              size === "sm" ? "h-6 px-1.5 text-[11px]" : "h-7 px-2 text.xs",
              isActive
                ? "bg-[var(--bg-card,#171717)] text-[var(--fg,#FFF)] shadow-xs"
                : "text-[var(--fg-muted,#A3A3A3)] hover:text-[var(--fg,#FFF)]"
            )}
          >
            {option.icon ? (
              <span className="flex shrink-0 items-center">{option.icon}</span>
            ) : null}
            {option.label ? <span>{option.label}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
