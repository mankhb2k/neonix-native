import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type AvatarSize = "sm" | "md" | "lg";

export type AvatarProps = {
  src?: string | null;
  name?: string;
  size?: AvatarSize;
  className?: string;
  /** Overrides the image/initials rendering — e.g. for a flag or custom icon. */
  children?: ReactNode;
};

const sizeStyles: Record<AvatarSize, string> = {
  sm: "size-8 text-body",
  md: "size-10 text-body",
  lg: "size-12 text-lg",
};

export function Avatar({ src, name, size = "md", className, children }: AvatarProps) {
  const initial = name?.trim().slice(0, 1).toUpperCase() || "?";

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--accent-soft)] font-semibold text-[var(--hub-accent)]",
        sizeStyles[size],
        className,
      )}
    >
      {children ? (
        children
      ) : src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        initial
      )}
    </span>
  );
}
