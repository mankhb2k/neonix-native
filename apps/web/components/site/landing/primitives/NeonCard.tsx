import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Frosted glass card with a neon border + hover glow. */
export function NeonCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)] p-6 backdrop-blur-md transition duration-200 hover:-translate-y-0.5 hover:border-[var(--neon-cyan-loud)] hover:shadow-[0_0_35px_rgba(34,211,238,0.18)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
