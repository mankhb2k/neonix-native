import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type GlowButtonProps = {
  href: string;
  variant?: "primary" | "secondary";
  children: ReactNode;
  className?: string;
};

const base =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border px-6 text-[15px] font-semibold no-underline transition duration-200 will-change-transform";

const variants = {
  primary:
    "border-transparent bg-[var(--accent)] text-[var(--accent-on)] shadow-[0_0_0_1px_rgba(34,211,238,0.4),0_8px_30px_var(--landing-glow-cyan)] hover:-translate-y-px hover:bg-[var(--accent-hover)] hover:shadow-[0_0_0_1px_rgba(103,232,249,0.6),0_12px_42px_rgba(34,211,238,0.5)]",
  secondary:
    "border-[var(--glass-border)] bg-[var(--glass-surface)] text-[var(--fg-primary)] backdrop-blur-md hover:-translate-y-px hover:border-[var(--neon-cyan-loud)] hover:shadow-[0_0_30px_rgba(34,211,238,0.25)]",
};

export function GlowButton({
  href,
  variant = "primary",
  children,
  className,
}: GlowButtonProps) {
  const cls = cn(base, variants[variant], className);

  if (href.startsWith("http")) {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  }

  // Internal routes via <a> keep marketing shell simple and avoid prefetch.
  return (
    <a href={href} className={cls}>
      {children}
    </a>
  );
}
