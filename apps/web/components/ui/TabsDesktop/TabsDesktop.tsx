"use client";

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DesktopTabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsDesktopProps {
  items: DesktopTabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  scrollAmount?: number;
}

export function TabsDesktop({
  items,
  value,
  onChange,
  className,
  scrollAmount = 180,
}: TabsDesktopProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;

    checkScroll();
    const observer = new ResizeObserver(() => checkScroll());
    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [checkScroll, items]);

  function handleScrollLeft() {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: -scrollAmount, behavior: "smooth" });
  }

  function handleScrollRight() {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
  }

  return (
    <div className={cn("relative flex h-[38px] w-full items-center overflow-hidden select-none", className)}>
      {/* Left Scroll Button */}
      {canScrollLeft ? (
        <div className="absolute top-0 bottom-0 left-0 z-20 flex items-center pr-3 pl-1 bg-gradient-to-r from-[var(--bg-panel)] via-[var(--bg-panel)]/90 to-transparent">
          <button
            type="button"
            onClick={handleScrollLeft}
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded bg-[#27272a] text-[#a0a0a5] hover:bg-[#3f3f46] hover:text-white shadow-sm transition-all"
            aria-label="Cuộn sang trái"
            title="Cuộn sang trái"
          >
            <ChevronLeft size={14} strokeWidth={2} />
          </button>
        </div>
      ) : null}

      {/* Tabs Container */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex h-full w-full items-center gap-1 overflow-x-auto px-2 no-scrollbar scroll-smooth"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {items.map((item) => {
          const isActive = value === item.id;
          return (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled}
              onClick={() => !item.disabled && onChange(item.id)}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-all cursor-pointer whitespace-nowrap",
                isActive
                  ? "bg-[var(--bg-hover)] text-[var(--accent-text)] font-semibold"
                  : "text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-hover)]/50",
                item.disabled && "opacity-40 cursor-not-allowed",
              )}
            >
              {item.icon ? (
                <span className="inline-flex items-center justify-center text-current">
                  {item.icon}
                </span>
              ) : null}
              <span>{item.label}</span>
              {isActive ? (
                <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-[var(--accent-text)]" />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Right Scroll Button */}
      {canScrollRight ? (
        <div className="absolute top-0 bottom-0 right-0 z-20 flex items-center pl-3 pr-1 bg-gradient-to-l from-[var(--bg-panel)] via-[var(--bg-panel)]/90 to-transparent">
          <button
            type="button"
            onClick={handleScrollRight}
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded bg-[#27272a] text-[#a0a0a5] hover:bg-[#3f3f46] hover:text-white shadow-sm transition-all"
            aria-label="Cuộn sang phải"
            title="Cuộn sang phải"
          >
            <ChevronRight size={14} strokeWidth={2} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
