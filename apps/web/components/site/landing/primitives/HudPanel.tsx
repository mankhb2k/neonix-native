import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Neon HUD panel with corner brackets. */
export function HudPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative rounded-lg border border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--bg-surface)_82%,transparent)] p-5",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute left-[-1px] top-[-1px] h-3 w-3 border-l-2 border-t-2 border-[var(--accent)]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute right-[-1px] top-[-1px] h-3 w-3 border-r-2 border-t-2 border-[var(--accent)]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-[-1px] left-[-1px] h-3 w-3 border-b-2 border-l-2 border-[var(--accent)]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-[-1px] right-[-1px] h-3 w-3 border-b-2 border-r-2 border-[var(--accent)]"
      />
      {children}
    </div>
  );
}
