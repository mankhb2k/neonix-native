"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type TabsProps = {
  items: Array<{ id: string; label: string; content: ReactNode }>;
  defaultValue?: string;
  className?: string;
};

export function Tabs({ items, defaultValue, className }: TabsProps) {
  const baseId = useId();
  const [active, setActive] = useState(defaultValue ?? items[0]?.id ?? "");
  const current = items.find((item) => item.id === active) ?? items[0];

  if (!current) return null;

  const isAiPanel = current.id === "ai";

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div
        role="tablist"
        className="flex w-full shrink-0 gap-0.5 border-b border-[var(--border-subtle)] px-2 py-1.5"
      >
        {items.map((item) => {
          const selected = item.id === current.id;
          return (
            <button
              key={item.id}
              id={`${baseId}-${item.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              className={cn(
                "h-8 flex-1 px-2.5 text-center text-ui font-medium transition-colors cursor-pointer [font-family:var(--font-sans)]",
                selected
                  ? "text-[var(--fg-primary)]"
                  : "text-[var(--fg-muted)] hover:text-[var(--fg-secondary)]",
              )}
              onClick={() => setActive(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        aria-labelledby={`${baseId}-${current.id}`}
        className={cn(
          "min-h-0 flex-1",
          isAiPanel ? "overflow-hidden" : "overflow-auto",
        )}
      >
        {current.content}
      </div>
    </div>
  );
}
