import { Loader2 } from "lucide-react";
import * as React from "react";
import { cn } from "../cn";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "secondary"
    | "outline"
    | "ghost"
    | "danger"
    | "link"
    | "action";
  size?: "xs" | "sm" | "md" | "lg";
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  iconOnly?: boolean;
  isIconOnly?: boolean;
  loading?: boolean;
}

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-[#d9381e] text-white border-transparent hover:bg-[#b92b15]",
  secondary:
    "bg-[var(--bg-hover)] text-[var(--fg)] border-[var(--line-strong)] hover:bg-[var(--line-strong)]",
  action:
    "bg-[var(--bg-elevated)] text-[var(--fg)] border-[var(--line-strong)] hover:bg-[var(--bg-hover)] hover:border-[var(--fg-muted)]",
  outline:
    "bg-transparent text-[var(--fg)] border-[var(--line-strong)] hover:bg-[var(--bg-hover)]",
  ghost:
    "bg-transparent text-[var(--fg-muted)] border-transparent hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]",
  danger: "bg-[#dc2626] text-white border-transparent hover:bg-[#b91c1c]",
  link: "bg-transparent text-blue-500 underline border-transparent hover:text-blue-400",
};

const sizeStyles: Record<NonNullable<ButtonProps["size"]>, string> = {
  xs: "h-[22px] px-1.5 text-[11px]",
  sm: "h-[26px] px-2 text-[12px]",
  md: "h-[32px] px-3 text-[13px]",
  lg: "h-[40px] px-4 text-[14px]",
};

const iconOnlySizeStyles: Record<NonNullable<ButtonProps["size"]>, string> = {
  xs: "w-[22px] px-0",
  sm: "w-[26px] px-0",
  md: "w-[32px] px-0",
  lg: "w-[40px] px-0",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "action",
      size = "sm",
      leftIcon,
      rightIcon,
      iconOnly,
      isIconOnly,
      loading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const isIcon =
      iconOnly || isIconOnly || (!children && Boolean(leftIcon || rightIcon));

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-1 rounded font-sans text-[12px] font-normal cursor-pointer whitespace-nowrap transition-all duration-150 select-none outline-none border border-transparent disabled:opacity-40 disabled:cursor-not-allowed",
          variantStyles[variant],
          sizeStyles[size],
          isIcon && iconOnlySizeStyles[size],
          loading && "opacity-80 cursor-wait",
          className,
        )}
        {...props}
      >
        {loading ? (
          <span className="inline-flex items-center justify-center leading-none">
            <Loader2
              className="animate-spin"
              size={size === "xs" ? 11 : size === "lg" ? 16 : 13}
            />
          </span>
        ) : (
          leftIcon && (
            <span className="inline-flex items-center justify-center leading-none shrink-0">
              {leftIcon}
            </span>
          )
        )}
        {children && <span>{children}</span>}
        {!loading && rightIcon && (
          <span className="inline-flex items-center justify-center leading-none shrink-0">
            {rightIcon}
          </span>
        )}
      </button>
    );
  },
);

Button.displayName = "Button";
