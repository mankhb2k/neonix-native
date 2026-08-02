import * as React from "react";
import { cn } from "../cn";

export interface AvatarProps extends React.HTMLAttributes<HTMLElement> {
  /** Image URL. Falls back to `fallback` / children when missing or broken. */
  src?: string;
  alt?: string;
  /** Initials / letter shown when there is no image. */
  fallback?: React.ReactNode;
  size?: "xs" | "sm" | "md" | "lg";
  /**
   * user — account chip (default rounded="full")
   * logo — brand mark (default rounded={4})
   */
  variant?: "user" | "logo";
  /**
   * Corner radius:
   * - `"full"` — fully circular
   * - number — radius in px (e.g. `4` → 4px)
   */
  rounded?: "full" | number;
  /** When set, renders a button for clickable avatars (logo / profile). */
  onClick?: React.MouseEventHandler<HTMLElement>;
}

const sizeStyles: Record<NonNullable<AvatarProps["size"]>, string> = {
  xs: "h-[18px] w-[18px] text-[9px]",
  sm: "h-[22px] w-[22px] text-[11px]",
  md: "h-[26px] w-[26px] text-[12px]",
  lg: "h-[32px] w-[32px] text-[13px]",
};

const variantStyles: Record<NonNullable<AvatarProps["variant"]>, string> = {
  user: "border border-[var(--line-strong)] bg-[var(--bg-hover)] text-[var(--fg-muted)]",
  logo: "border-0 bg-[#d9381e] text-white font-bold",
};

function resolveRounded(
  rounded: AvatarProps["rounded"],
  variant: NonNullable<AvatarProps["variant"]>,
): "full" | number {
  if (rounded !== undefined) return rounded;
  return variant === "logo" ? 4 : "full";
}

export const Avatar = React.forwardRef<HTMLElement, AvatarProps>(
  (
    {
      className,
      src,
      alt = "",
      fallback,
      size = "sm",
      variant = "user",
      rounded,
      onClick,
      children,
      style,
      ...props
    },
    ref,
  ) => {
    const [imgFailed, setImgFailed] = React.useState(false);
    const showImage = Boolean(src) && !imgFailed;
    const label = children ?? fallback;
    const radius = resolveRounded(rounded, variant);

    React.useEffect(() => {
      setImgFailed(false);
    }, [src]);

    const classes = cn(
      "inline-flex shrink-0 items-center justify-center overflow-hidden select-none",
      sizeStyles[size],
      variantStyles[variant],
      radius === "full" && "rounded-full",
      onClick && "cursor-pointer",
      className,
    );

    const mergedStyle: React.CSSProperties = {
      ...(typeof radius === "number" ? { borderRadius: radius } : null),
      ...style,
    };

    const content = showImage ? (
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover"
        onError={() => setImgFailed(true)}
        draggable={false}
      />
    ) : (
      <span className="leading-none">{label}</span>
    );

    if (onClick) {
      return (
        <button
          ref={ref as React.Ref<HTMLButtonElement>}
          type="button"
          className={classes}
          style={mergedStyle}
          onClick={onClick}
          {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        >
          {content}
        </button>
      );
    }

    return (
      <span
        ref={ref as React.Ref<HTMLSpanElement>}
        className={classes}
        style={mergedStyle}
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        {...props}
      >
        {content}
      </span>
    );
  },
);

Avatar.displayName = "Avatar";
