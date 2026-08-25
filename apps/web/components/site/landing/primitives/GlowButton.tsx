import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type GlowButtonProps = {
  href: string;
  variant?: "primary" | "secondary";
  children: ReactNode;
  className?: string;
};

const base =
  "inline-flex h-10 items-center justify-center gap-2 rounded-full border px-4 text-[14px] font-semibold no-underline transition duration-200 will-change-transform";

const variants = {
  primary:
    "border-transparent bg-[var(--accent)] text-[var(--accent-on)] shadow-[0_0_0_1px_rgba(34,211,238,0.3),0_6px_22px_var(--landing-glow-cyan)] hover:-translate-y-px hover:bg-[var(--accent-hover)] hover:shadow-[0_0_0_1px_rgba(103,232,249,0.5),0_9px_30px_rgba(34,211,238,0.4)]",
  secondary:
    "border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--glass-surface)_55%,transparent)] text-[var(--fg-primary)] backdrop-blur-md hover:-translate-y-px hover:border-[var(--neon-cyan-loud)] hover:bg-[color-mix(in_srgb,var(--glass-surface)_70%,transparent)] hover:shadow-[0_0_22px_rgba(34,211,238,0.18)]",
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
