"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "type" | "value"> {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onChange, min, max, step = 1, className, disabled, ...props }, ref) => {
    function clamp(next: number): number {
      let result = next;
      if (min !== undefined) result = Math.max(min, result);
      if (max !== undefined) result = Math.min(max, result);
      return result;
    }

    return (
      <div
        className={cn(
          "flex items-stretch overflow-hidden rounded-lg border border-[var(--border-strong)] bg-transparent focus-within:border-[var(--accent)]",
          disabled && "opacity-40",
          className,
        )}
      >
        <input
          ref={ref}
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
          className="w-full min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-[var(--fg-primary)] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          {...props}
        />
        <div className="flex flex-col divide-y divide-[var(--border-strong)] border-l border-[var(--border-strong)]">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Increment"
            disabled={disabled || (max !== undefined && value >= max)}
            onClick={() => onChange(clamp(value + step))}
            className="flex flex-1 items-center justify-center px-1.5 text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronUp className="size-3" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Decrement"
            disabled={disabled || (min !== undefined && value <= min)}
            onClick={() => onChange(clamp(value - step))}
            className="flex flex-1 items-center justify-center px-1.5 text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronDown className="size-3" />
          </button>
        </div>
      </div>
    );
  },
);

NumberInput.displayName = "NumberInput";
