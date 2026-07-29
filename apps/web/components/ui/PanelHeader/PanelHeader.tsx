"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface PanelHeaderProps {
  children?: React.ReactNode;
  title?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  noBorder?: boolean;
}

/**
 * Standardized PanelHeader component with fixed height (h-[38px])
 * used across Sidebar, Stage, and Inspector cards for uniform baseline alignment.
 */
export function PanelHeader({
  children,
  title,
  actions,
  className,
  noBorder = false,
}: PanelHeaderProps) {
  return (
    <div
      className={cn(
        "flex h-[40px] min-h-[40px] max-h-[40px] shrink-0 items-center justify-between gap-2 px-3 select-none overflow-hidden",
        !noBorder && "border-b border-[var(--border-subtle)]",
        className,
      )}
    >
      {title ? (
        <div className="flex items-center gap-2 font-semibold text-[13px] text-[var(--fg-primary)] truncate">
          {title}
        </div>
      ) : children ? (
        <div className="flex-1 min-w-0 flex items-center h-full">
          {children}
        </div>
      ) : null}

      {actions ? (
        <div className="flex items-center gap-1 shrink-0">{actions}</div>
      ) : null}
    </div>
  );
}
