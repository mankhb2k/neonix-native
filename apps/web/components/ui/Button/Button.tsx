import { Loader2 } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "outline"
  | "nav";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
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
  nav: "bg-transparent border-transparent hover:bg-[var(--bg-hover,#f4f4f5)]",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-[12px]",
  md: "h-8 px-3 text-[13px]",
  lg: "h-auto rounded-lg px-3.5 py-2 text-[14px]",
  icon: "h-7 w-7 p-0",
};

const buttonBaseClass =
  "inline-flex items-center justify-center gap-1.5 rounded-md font-medium cursor-pointer whitespace-nowrap transition-[background,color,filter] duration-150 select-none outline-none border no-underline disabled:opacity-40 disabled:cursor-not-allowed";

export function buttonClassName({
  variant = "secondary",
  size = "sm",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(buttonBaseClass, variantStyles[variant], sizeStyles[size], className);
}

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
        className={buttonClassName({
          variant,
          size,
          className: cn(loading && "opacity-80 cursor-wait", className),
        })}
        {...props}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
