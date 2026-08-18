import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Shared vertical rhythm + max width for landing sections. */
export function Section({
  children,
  id,
  className,
}: {
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-20 sm:py-28",
        className,
      )}
    >
      {children}
    </section>
  );
}
