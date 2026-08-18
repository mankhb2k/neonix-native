import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Serif cinematic section heading (Fraunces via --font-display). */
export function SectionHeading({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      style={{ fontFamily: "var(--font-display)" }}
      className={cn(
        "text-[clamp(1.75rem,4vw,2.75rem)] font-semibold leading-[1.15] tracking-[-0.02em] text-[var(--fg-primary)]",
        className,
      )}
    >
      {children}
    </h2>
  );
}
