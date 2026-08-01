import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../cn";

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
  stacked?: boolean;
}

export function TabsDesktop({
  items,
  value,
  onChange,
  className,
  scrollAmount = 180,
  stacked = false,
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
    return () => observer.disconnect();
  }, [checkScroll, items]);

  return (
    <div
      className={cn(
        "relative flex h-full w-full items-stretch overflow-hidden select-none",
        className,
      )}
    >
      {canScrollLeft ? (
        <div className="absolute top-0 bottom-0 left-0 z-20 flex items-center pr-3 pl-1 bg-gradient-to-r from-[var(--bg-panel)] via-[var(--bg-panel)]/90 to-transparent">
          <button
            type="button"
            onClick={() =>
              scrollRef.current?.scrollBy({
                left: -scrollAmount,
                behavior: "smooth",
              })
            }
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded bg-[#27272a] text-[#a0a0a5] hover:bg-[#3f3f46] hover:text-white shadow-sm transition-all"
            aria-label="Scroll left"
          >
            <ChevronLeft size={14} strokeWidth={2} />
          </button>
        </div>
      ) : null}

      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex h-full w-full items-stretch gap-1.5 overflow-x-auto px-2 scroll-smooth"
        style={{ scrollbarWidth: "none" }}
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
                stacked
                  ? "flex shrink-0 h-full self-stretch flex-col items-center justify-center gap-0 px-2 py-0 text-[9px] font-medium transition-colors bg-transparent cursor-pointer whitespace-nowrap outline-none border-none"
                  : "flex shrink-0 h-full self-stretch items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium transition-colors bg-transparent cursor-pointer whitespace-nowrap outline-none border-none",
                isActive
                  ? "text-[var(--tab-fg-active)] font-semibold"
                  : "text-[var(--tab-fg)] hover:text-[var(--tab-fg-hover)]",
                item.disabled && "opacity-40 cursor-not-allowed",
              )}
            >
              {item.icon ? (
                <span className="inline-flex items-center justify-center text-current leading-none">
                  {item.icon}
                </span>
              ) : null}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {canScrollRight ? (
        <div className="absolute top-0 bottom-0 right-0 z-20 flex items-center pl-3 pr-1 bg-gradient-to-l from-[var(--bg-panel)] via-[var(--bg-panel)]/90 to-transparent">
          <button
            type="button"
            onClick={() =>
              scrollRef.current?.scrollBy({
                left: scrollAmount,
                behavior: "smooth",
              })
            }
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded bg-[#27272a] text-[#a0a0a5] hover:bg-[#3f3f46] hover:text-white shadow-sm transition-all"
            aria-label="Scroll right"
          >
            <ChevronRight size={14} strokeWidth={2} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
