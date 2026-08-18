import { cn } from "@/lib/utils";

/** Subtle horizontal scanline overlay. */
export function ScanlineOverlay({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0", className)}
      style={{
        backgroundImage:
          "repeating-linear-gradient(0deg, transparent 0 2px, var(--scanline) 2px 3px)",
      }}
    />
  );
}
