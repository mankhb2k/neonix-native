import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../cn";

export type PresetTileProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  title?: string;
  active?: boolean;
  aspect?: "square" | "landscape";
  paddingClassName?: string;
  children?: ReactNode;
  icon?: ReactNode;
};

export function PresetTile({
  title,
  active = false,
  disabled = false,
  aspect = "square",
  paddingClassName,
  className,
  children,
  icon,
  ...props
}: PresetTileProps) {
  const defaultPadding = aspect === "landscape" ? "p-0" : "p-3";
  const sizeClasses =
    aspect === "landscape" ? "w-[118px] h-[66px]" : "w-[64px] h-[64px]";

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      className={cn(
        "group relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#222225] text-white transition-all shadow-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400",
        sizeClasses,
        active
          ? "ring-2 ring-cyan-400 bg-[#2c2c30]"
          : "hover:bg-[#2c2c30] active:scale-95",
        disabled && "opacity-50 cursor-not-allowed active:scale-100",
        paddingClassName ?? defaultPadding,
        className
      )}
      {...props}
    >
      {children ?? icon}
    </button>
  );
}
