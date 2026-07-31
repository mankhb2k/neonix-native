"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface KeyframeToggleProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  hasKeyframe?: boolean;
  label?: string;
}

export function KeyframeToggle({
  active = false,
  hasKeyframe = false,
  label = "Chuyển đổi keyframe",
  className,
  disabled,
  onClick,
  ...props
}: KeyframeToggleProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-[3px] transition-colors focus:outline-none disabled:opacity-30",
        active || hasKeyframe
          ? "text-[var(--accent,#3B82F6)] hover:opacity-80"
          : "text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]",
        className
      )}
      {...props}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 12 12"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="transition-transform duration-100 hover:scale-110"
      >
        <path
          d="M6 1L11 6L6 11L1 6L6 1Z"
          stroke="currentColor"
          fill={active || hasKeyframe ? "currentColor" : "none"}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
