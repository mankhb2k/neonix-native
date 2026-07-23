"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label?: string;
  icon?: React.ReactNode;
  tooltip?: string;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  variant?: "underline" | "pills" | "segment";
  rounded?: "none" | "sm" | "md" | "lg" | "full";
  size?: "sm" | "md" | "lg";
  borderless?: boolean;
  className?: string;
}

const roundedStyles: Record<NonNullable<TabsProps["rounded"]>, string> = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-xl",
  full: "rounded-full",
};

const sizeStyles: Record<NonNullable<TabsProps["size"]>, string> = {
  sm: "px-2 py-1 text-[12px]",
  md: "px-3 py-1.5 text-[13px]",
  lg: "px-4 py-2 text-[14px]",
};

export function Tabs({
  items,
  value,
  onChange,
  variant = "underline",
  rounded = "md",
  size = "sm",
  borderless = false,
  className,
}: TabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [sliderStyle, setSliderStyle] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });

  // Calculate sliding indicator position and width
  useEffect(() => {
    const activeBtn = tabRefs.current.get(value);
    const container = containerRef.current;
    if (activeBtn && container) {
      const btnRect = activeBtn.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setSliderStyle({
        left: btnRect.left - containerRect.left,
        width: btnRect.width,
      });
    }
  }, [value, items]);

  return (
    <nav
      ref={containerRef}
      className={cn(
        "inline-flex items-center select-none text-[12px] relative",
        variant === "underline" && "gap-0.5 h-full",
        variant === "pills" && "gap-1",
        variant === "segment" &&
          cn(
            "bg-[var(--bg-elevated)] border border-[var(--line)] p-1 gap-0.5",
            roundedStyles[rounded],
            borderless && "border-transparent bg-transparent"
          ),
        className
      )}
      role="tablist"
    >
      {items.map((item) => {
        const isActive = value === item.id;
        const isIconOnly = Boolean(item.icon && !item.label);
        const tooltipText = item.tooltip || item.label;

        return (
          <button
            key={item.id}
            ref={(el) => {
              if (el) tabRefs.current.set(item.id, el);
              else tabRefs.current.delete(item.id);
            }}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={item.disabled}
            title={isIconOnly ? tooltipText : undefined}
            className={cn(
              "group relative inline-flex items-center justify-center gap-1.5 bg-transparent border border-transparent text-[var(--fg-muted)] font-normal cursor-pointer transition-all duration-150 outline-none hover:text-[var(--fg)]",
              sizeStyles[size],
              roundedStyles[rounded],
              variant === "underline" && "h-full rounded-none border-b-0",
              variant === "pills" &&
                !borderless &&
                isActive &&
                "bg-[var(--bg-elevated)] border-[var(--line-strong)] text-[var(--fg)] font-medium",
              variant === "pills" &&
                !borderless &&
                !isActive &&
                "hover:bg-[var(--bg-hover)]",
              variant === "segment" &&
                !borderless &&
                isActive &&
                "bg-[var(--bg-panel)] shadow-sm text-[var(--fg)] font-medium",
              borderless &&
                isActive &&
                "bg-transparent text-white border-transparent font-medium",
              borderless &&
                !isActive &&
                "bg-transparent hover:bg-transparent hover:text-white",
              isIconOnly && "p-1.5",
              item.disabled && "opacity-40 cursor-not-allowed"
            )}
            onClick={() => !item.disabled && onChange(item.id)}
          >
            {item.icon && (
              <span className="inline-flex items-center justify-center leading-none shrink-0">
                {item.icon}
              </span>
            )}
            {item.label && (
              <span 
                className="inline-flex flex-col items-center leading-none after:block after:h-0 after:overflow-hidden after:font-medium after:invisible after:content-[attr(data-label)]"
                data-label={item.label}
              >
                {item.label}
              </span>
            )}

            {/* Custom Tooltip Popup for Icon-Only Mode */}
            {isIconOnly && tooltipText && (
              <span
                className="absolute bottom-[-32px] left-1/2 -translate-x-1/2 bg-[#18181b] text-[#fafafa] border border-[#3f3f46] text-[11px] font-normal px-2 py-0.5 rounded whitespace-nowrap pointer-events-none opacity-0 invisible transition-all duration-150 delay-0 group-hover:opacity-100 group-hover:visible group-hover:delay-500 z-50 shadow-lg"
                role="tooltip"
              >
                {tooltipText}
              </span>
            )}
          </button>
        );
      })}

      {/* Animated Sliding Indicator for Underline Variant */}
      {variant === "underline" && sliderStyle.width > 0 && (
        <span
          className="absolute bottom-0 left-0 h-[2px] bg-[#d9381e] rounded-t transition-all duration-250 ease-out pointer-events-none"
          style={{
            transform: `translateX(${sliderStyle.left}px)`,
            width: `${sliderStyle.width}px`,
          }}
        />
      )}
    </nav>
  );
}
