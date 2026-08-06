import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "icon";
  loading?: boolean;
}

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-[var(--accent)] text-[var(--accent-on)] border-transparent hover:bg-[var(--accent-hover)] shadow-sm",
  secondary:
    "bg-[var(--bg-elevated)] text-[var(--fg-primary)] border-[var(--border-strong)] hover:bg-[var(--bg-hover)]",
  ghost:
    "bg-transparent text-[var(--fg-muted)] border-transparent hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]",
  outline:
    "bg-transparent text-[var(--fg-primary)] border-[var(--border-strong)] hover:bg-[var(--bg-hover)]",
  danger:
    "bg-[var(--danger)] text-white border-transparent hover:brightness-110",
};

const sizeStyles: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-7 px-2.5 text-[12px]",
  md: "h-8 px-3 text-[13px]",
  icon: "h-7 w-7 p-0",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "secondary",
      size = "sm",
      loading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-md font-medium cursor-pointer whitespace-nowrap transition-[background,color,filter] duration-150 select-none outline-none border disabled:opacity-40 disabled:cursor-not-allowed",
          variantStyles[variant],
          sizeStyles[size],
          loading && "opacity-80 cursor-wait",
          className,
        )}
        {...props}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
