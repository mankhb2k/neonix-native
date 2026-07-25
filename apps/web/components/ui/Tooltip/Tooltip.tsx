import * as React from "react";
import { cn } from "@/lib/utils";

export interface TooltipProps {
  content: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  children: React.ReactNode;
  className?: string;
}

const sideStyles: Record<NonNullable<TooltipProps["side"]>, string> = {
  top: "bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 translate-y-0.5 group-hover:translate-y-0",
  bottom:
    "top-[calc(100%+6px)] left-1/2 -translate-x-1/2 -translate-y-0.5 group-hover:translate-y-0",
  left: "right-[calc(100%+6px)] top-1/2 -translate-y-1/2 translate-x-0.5 group-hover:translate-x-0",
  right:
    "left-[calc(100%+6px)] top-1/2 -translate-y-1/2 -translate-x-0.5 group-hover:translate-x-0",
};

export function Tooltip({
  content,
  side = "top",
  children,
  className,
}: TooltipProps) {
  if (!content) return <>{children}</>;

  return (
    <div className={cn("group relative inline-flex items-center justify-center", className)}>
      {children}
      <div
        role="tooltip"
        className={cn(
          "absolute bg-[var(--bg-elevated)] text-[var(--fg)] border border-[var(--line-strong)] text-[11px] font-normal px-2 py-1 rounded whitespace-nowrap pointer-events-none opacity-0 invisible transition-all duration-150 delay-0 group-hover:opacity-100 group-hover:visible group-hover:delay-500 z-50 shadow-lg",
          sideStyles[side]
        )}
      >
        {content}
      </div>
    </div>
  );
}
