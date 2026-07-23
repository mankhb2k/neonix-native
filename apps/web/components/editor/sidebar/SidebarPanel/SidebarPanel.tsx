import React from "react";
import { cn } from "@/lib/utils";

export function SidebarPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col w-full h-full", className)}>
      {children}
    </div>
  );
}

export function SidebarPanelHeader({
  children,
  className,
  noBorder = true,
}: {
  children: React.ReactNode;
  className?: string;
  noBorder?: boolean;
}) {
  return (
    <div
      className={cn(
        "px-4 py-1.5 flex items-center justify-between gap-2",
        !noBorder && "border-b border-[var(--line-strong)]",
        className
      )}
    >
      <div className="flex-1 min-w-0">
        {typeof children === "string" ? (
          <h3 className="text-title font-semibold text-[var(--fg)] flex items-center min-h-[32px]">
            {children}
          </h3>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

export function SidebarPanelContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex-1 overflow-y-auto px-4 py-2", className)}>
      {children}
    </div>
  );
}
