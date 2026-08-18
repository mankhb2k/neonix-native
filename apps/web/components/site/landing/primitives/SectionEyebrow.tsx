import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Mono uppercase accent label used to open every section. */
export function SectionEyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "font-mono text-[12px] uppercase tracking-[0.18em] text-[var(--accent-text)]",
        className,
      )}
    >
      {children}
    </p>
  );
}
